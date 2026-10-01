#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Buscador Bibliográfico Académico Automatizado para Tesis de Baterías de Ion de Litio
Fuentes oficiales: OpenAlex, Crossref, arXiv, Semantic Scholar (Sin API Keys).
Genera reportes en Markdown, JSON, BibTeX y exportación directa para ForoMagma.
"""

import os
import sys
import re
import json
import time
import urllib.request
import urllib.parse
import urllib.error
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional

# ==============================================================================
# CONFIGURACIÓN GENERAL Y POLITE POOL
# ==============================================================================
CORREO = "ivanmezaf@users.noreply.github.com"
USER_AGENT = f"ForoMagmaAcademicBot/1.0 (mailto:{CORREO}; Research on Li-Ion Battery Second Life & BMS)"

API_CONFIG = {
    "openalex": {
        "url": "https://api.openalex.org/works",
        "timeout": 12,
        "max_retries": 3
    },
    "crossref": {
        "url": "https://api.crossref.org/works",
        "timeout": 12,
        "max_retries": 3
    },
    "arxiv": {
        "url": "http://export.arxiv.org/api/query",
        "timeout": 14,
        "max_retries": 3
    },
    "semantic_scholar": {
        "url": "https://api.semanticscholar.org/graph/v1/paper/search",
        "timeout": 12,
        "max_retries": 3
    }
}

# Temas clave para investigación de baterías
TOPICS = {
    "segunda_vida": "second life lithium ion battery repurposing",
    "bms_segunda_vida": "BMS battery management system second life batteries",
    "soh_estimacion": "lithium ion battery State of Health SoH estimation Kalman filter",
    "soc_medicion": "lithium battery State of Charge SoC estimation coulomb counting OCV",
    "carga_rapida": "lithium ion battery fast charging degradation cycle life test",
    "estandar_bms": "battery management system BMS standards IEC ISO IEEE",
    "colombia_latam": "baterias ion litio segunda vida Colombia OR Latin America"
}


# ==============================================================================
# CLIENTE HTTP ROBUSTO CON RETRIES Y HEADERS POLITE POOL
# ==============================================================================
def http_get(url: str, headers: Optional[Dict[str, str]] = None, timeout: int = 12) -> Optional[bytes]:
    """Realiza una petición HTTP GET con reintentos y retroceso exponencial."""
    req_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, application/xml, text/html, */*"
    }
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(url, headers=req_headers)

    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                if 200 <= response.status < 400:
                    return response.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                sleep_sec = attempt * 2
                time.sleep(sleep_sec)
                continue
            return None
        except Exception:
            time.sleep(1)
            continue
    return None


def verify_url_active(url: str, timeout: int = 5) -> bool:
    """Verifica que un enlace responda con código 200-399 para evitar enlaces rotos."""
    if not url or not url.startswith("http"):
        return False
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT}, method="HEAD")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 400
    except Exception:
        # Fallback con GET breve si el servidor rechaza HEAD
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT}, method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return 200 <= resp.status < 400
        except Exception:
            return False


# ==============================================================================
# RECONSTRUCCIÓN DEL ABSTRACT EN OPENALEX
# ==============================================================================
def reconstruct_openalex_abstract(inverted_index: Optional[Dict[str, List[int]]]) -> str:
    """Reconstruye el texto continuo a partir del abstract_inverted_index de OpenAlex."""
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""
    pos_word = []
    for word, positions in inverted_index.items():
        for pos in positions:
            pos_word.append((pos, word))
    pos_word.sort(key=lambda x: x[0])
    return " ".join(w for _, w in pos_word)


# ==============================================================================
# BÚSQUEDA EN OPENALEX
# ==============================================================================
def search_openalex(query: str, limit: int = 15, from_year: Optional[int] = 2019) -> List[Dict[str, Any]]:
    """Consulta la API de OpenAlex con filtros de año, acceso abierto y orden por citas."""
    results = []
    params = {
        "search": query,
        "per_page": limit,
        "sort": "cited_by_count:desc",
        "mailto": CORREO
    }
    filters = []
    if from_year:
        filters.append(f"from_publication_date:{from_year}-01-01")
    if filters:
        params["filter"] = ",".join(filters)

    url = f"{API_CONFIG['openalex']['url']}?{urllib.parse.urlencode(params)}"
    data = http_get(url, timeout=API_CONFIG['openalex']['timeout'])
    if not data:
        return results

    try:
        payload = json.loads(data.decode("utf-8"))
        for item in payload.get("results", []):
            doi = item.get("doi") or ""
            title = (item.get("title") or "").strip()
            if not title:
                continue

            authors = []
            for authorship in item.get("authorships", []):
                author = authorship.get("author", {})
                display_name = author.get("display_name")
                if display_name:
                    authors.append(display_name)

            abstract = reconstruct_openalex_abstract(item.get("abstract_inverted_index"))

            # Enlace de acceso abierto si existe
            oa = item.get("open_access", {})
            oa_url = oa.get("oa_url") or ""

            # Lugar de publicación
            source = item.get("primary_location", {}).get("source", {})
            journal = source.get("display_name") if source else ""

            results.append({
                "source_api": "OpenAlex",
                "title": title,
                "authors": authors[:5],
                "year": item.get("publication_year"),
                "doi": doi,
                "journal": journal or "Publicación Académica",
                "citations": item.get("cited_by_count", 0),
                "url": doi if doi else item.get("id", ""),
                "open_access_pdf": oa_url,
                "abstract": abstract[:700] + ("..." if len(abstract) > 700 else ""),
                "is_oa": oa.get("is_oa", False)
            })
    except Exception as e:
        print(f"[!] Error al procesar OpenAlex: {e}", file=sys.stderr)

    return results


# ==============================================================================
# BÚSQUEDA EN CROSSREF
# ==============================================================================
def search_crossref(query: str, limit: int = 15, from_year: Optional[int] = 2019) -> List[Dict[str, Any]]:
    """Consulta la API oficial de Crossref Works."""
    results = []
    params = {
        "query": query,
        "rows": limit,
        "sort": "is-referenced-by-count",
        "order": "desc",
        "mailto": CORREO
    }
    if from_year:
        params["filter"] = f"from-pub-date:{from_year}-01-01"

    url = f"{API_CONFIG['crossref']['url']}?{urllib.parse.urlencode(params)}"
    data = http_get(url, timeout=API_CONFIG['crossref']['timeout'])
    if not data:
        return results

    try:
        payload = json.loads(data.decode("utf-8"))
        items = payload.get("message", {}).get("items", [])
        for item in items:
            titles = item.get("title", [])
            title = titles[0].strip() if titles else ""
            if not title:
                continue

            doi = f"https://doi.org/{item.get('DOI')}" if item.get("DOI") else ""

            authors = []
            for author in item.get("author", []):
                given = author.get("given", "")
                family = author.get("family", "")
                name = f"{given} {family}".strip()
                if name:
                    authors.append(name)

            year = None
            date_parts = item.get("published-print", {}).get("date-parts") or item.get("published-online", {}).get("date-parts")
            if date_parts and date_parts[0]:
                year = date_parts[0][0]

            abstract = item.get("abstract", "")
            # Limpiar tags JATS XML del abstract
            clean_abstract = re.sub(r"<[^>]+>", "", abstract).strip()

            container = item.get("container-title", [])
            journal = container[0] if container else "Revista Científica / Conferencia"

            results.append({
                "source_api": "Crossref",
                "title": title,
                "authors": authors[:5],
                "year": year,
                "doi": doi,
                "journal": journal,
                "citations": item.get("is-referenced-by-count", 0),
                "url": doi or item.get("URL", ""),
                "open_access_pdf": "",
                "abstract": clean_abstract[:700] + ("..." if len(clean_abstract) > 700 else ""),
                "is_oa": False
            })
    except Exception as e:
        print(f"[!] Error al procesar Crossref: {e}", file=sys.stderr)

    return results


# ==============================================================================
# BÚSQUEDA EN ARXIV
# ==============================================================================
def search_arxiv(query: str, limit: int = 15) -> List[Dict[str, Any]]:
    """Consulta la API de preprints arXiv (Atom XML)."""
    results = []
    clean_q = re.sub(r"[^\w\s]", " ", query).strip()
    encoded_q = urllib.parse.quote(clean_q)
    url = f"{API_CONFIG['arxiv']['url']}?search_query=all:{encoded_q}&start=0&max_results={limit}&sortBy=relevance&sortOrder=descending"

    data = http_get(url, timeout=API_CONFIG['arxiv']['timeout'])
    if not data:
        return results

    try:
        root = ET.fromstring(data)
        ns = {"atom": "http://www.w3.org/2005/Atom"}

        for entry in root.findall("atom:entry", ns):
            title = entry.find("atom:title", ns)
            title_text = " ".join((title.text or "").split()) if title is not None else ""
            if not title_text:
                continue

            summary = entry.find("atom:summary", ns)
            summary_text = " ".join((summary.text or "").split()) if summary is not None else ""

            published = entry.find("atom:published", ns)
            year = int(published.text[:4]) if published is not None and published.text else None

            authors = []
            for author in entry.findall("atom:author", ns):
                name = author.find("atom:name", ns)
                if name is not None and name.text:
                    authors.append(name.text.strip())

            pdf_link = ""
            entry_id = ""
            id_el = entry.find("atom:id", ns)
            if id_el is not None and id_el.text:
                entry_id = id_el.text.strip()

            for link in entry.findall("atom:link", ns):
                if link.get("title") == "pdf" or link.get("type") == "application/pdf":
                    pdf_link = link.get("href", "")

            results.append({
                "source_api": "arXiv",
                "title": title_text,
                "authors": authors[:5],
                "year": year,
                "doi": "",
                "journal": "arXiv Preprint",
                "citations": 0,
                "url": entry_id,
                "open_access_pdf": pdf_link or entry_id,
                "abstract": summary_text[:700] + ("..." if len(summary_text) > 700 else ""),
                "is_oa": True
            })
    except Exception as e:
        print(f"[!] Error al procesar arXiv: {e}", file=sys.stderr)

    return results


# ==============================================================================
# DEDUPLICACIÓN Y DETECCIÓN GEOGRÁFICA
# ==============================================================================
def normalize_title(title: str) -> str:
    """Normaliza un título para detectar duplicados."""
    return re.sub(r"[^a-z0-9]", "", title.lower())


def detect_scope(paper: Dict[str, Any]) -> str:
    """Detecta si el trabajo tiene relevancia local (Colombia / LatAm) o internacional."""
    text_corpus = f"{paper.get('title', '')} {paper.get('abstract', '')} {paper.get('journal', '')}".lower()
    if any(k in text_corpus for k in ["colombia", "santa marta", "antioquia", "bogota", "unimagdalena", "uis", "unal"]):
        return "🇨🇴 Colombia / Local"
    if any(k in text_corpus for k in ["latin america", "latinoamerica", "chile", "mexico", "brazil", "argentina"]):
        return "🌎 Latinoamérica"
    if any(k in text_corpus for k in ["spain", "españa", "europe", "european", "germany", "france"]):
        return "🇪🇺 Europa / España"
    return "🌐 Internacional"


def deduplicate_papers(papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Elimina duplicados basados en DOI y título normalizado."""
    seen_dois = set()
    seen_titles = set()
    unique = []

    for p in papers:
        doi = p.get("doi", "").lower().strip()
        norm_title = normalize_title(p.get("title", ""))

        if doi and doi in seen_dois:
            continue
        if norm_title and norm_title in seen_titles:
            continue

        if doi:
            seen_dois.add(doi)
        if norm_title:
            seen_titles.add(norm_title)

        p["scope"] = detect_scope(p)
        unique.append(p)

    return unique


# ==============================================================================
# GENERADORES DE SALIDA (MARKDOWN, JSON, BIBTEX, JS)
# ==============================================================================
def export_markdown(papers: List[Dict[str, Any]], filename: str, topic: str):
    """Genera el reporte Markdown estructurado y profesional."""
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"# 📚 Reporte de Literatura Científica: {topic}\n\n")
        f.write(f"- **Fecha de generación:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- **Total de publicaciones verificadas:** {len(papers)}\n")
        f.write(f"- **Ubicación de referencia:** Santa Marta, Colombia (Prioridad local y global)\n\n")
        f.write("---\n\n")

        for idx, p in enumerate(papers, 1):
            authors_str = ", ".join(p.get("authors") or ["Anónimo"])
            f.write(f"### {idx}. {p.get('title')}\n\n")
            f.write(f"- **Autores:** {authors_str}\n")
            f.write(f"- **Año:** {p.get('year') or 'N/D'} | **Fuente:** {p.get('journal')} ({p.get('source_api')})\n")
            f.write(f"- **Ámbito:** {p.get('scope')} | **Citas recibidas:** {p.get('citations', 0)}\n")
            f.write(f"- **Enlace Principal (DOI):** [{p.get('url')}]({p.get('url')})\n")
            if p.get("open_access_pdf"):
                f.write(f"- **Texto Completo Gratuito (PDF):** [Descargar Acceso Abierto]({p.get('open_access_pdf')})\n")
            if p.get("abstract"):
                f.write(f"\n> **Resumen:** {p.get('abstract')}\n")
            f.write("\n---\n\n")


def generate_bibtex(papers: List[Dict[str, Any]], filename: str):
    """Exporta las referencias a formato .bib listo para Zotero / Mendeley / LaTeX."""
    with open(filename, "w", encoding="utf-8") as f:
        for p in papers:
            authors = p.get("authors") or ["Autor"]
            first_author = re.sub(r"[^\w]", "", authors[0].split()[-1] if authors[0] else "Autor")
            year = p.get("year") or "2024"
            cite_key = f"{first_author}{year}_{abs(hash(p.get('title','')))%1000}"

            f.write(f"@article{{{cite_key},\n")
            f.write(f"  title = {{{{{p.get('title')}}}}},\n")
            f.write(f"  author = {{{' and '.join(authors)}}},\n")
            f.write(f"  journal = {{{p.get('journal')}}},\n")
            f.write(f"  year = {{{year}}},\n")
            if p.get("doi"):
                f.write(f"  doi = {{{p.get('doi').replace('https://doi.org/', '')}}},\n")
            if p.get("url"):
                f.write(f"  url = {{{p.get('url')}}},\n")
            f.write("}\n\n")


def export_for_foromagma(papers: List[Dict[str, Any]], filename: str):
    """Exporta los datos en formato JavaScript para incrustar en ForoMagma Web."""
    with open(filename, "w", encoding="utf-8") as f:
        f.write("// Base de Datos de Literatura Científica para ForoMagma\n")
        f.write(f"// Generado automáticamente: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("const FOROMAGMA_PAPERS_DB = ")
        f.write(json.dumps(papers, indent=2, ensure_ascii=False))
        f.write(";\n")


# ==============================================================================
# PIPELINE PRINCIPAL MULTI-API Y FILTRADO
# ==============================================================================
def search_all_sources(query: str, limit_per_source: int = 15, from_year: int = 2019) -> List[Dict[str, Any]]:
    """Ejecuta la búsqueda concurrente en todas las APIs oficiales."""
    print(f"[*] Iniciando búsqueda académica: '{query}'...")
    all_papers = []

    # 1. OpenAlex
    try:
        oa_papers = search_openalex(query, limit=limit_per_source, from_year=from_year)
        print(f"  [+] OpenAlex: {len(oa_papers)} artículos encontrados")
        all_papers.extend(oa_papers)
    except Exception as e:
        print(f"  [!] OpenAlex falló: {e}")

    # 2. Crossref
    try:
        cr_papers = search_crossref(query, limit=limit_per_source, from_year=from_year)
        print(f"  [+] Crossref: {len(cr_papers)} artículos encontrados")
        all_papers.extend(cr_papers)
    except Exception as e:
        print(f"  [!] Crossref falló: {e}")

    # 3. arXiv
    try:
        ax_papers = search_arxiv(query, limit=limit_per_source)
        print(f"  [+] arXiv: {len(ax_papers)} preprints encontrados")
        all_papers.extend(ax_papers)
    except Exception as e:
        print(f"  [!] arXiv falló: {e}")

    # Deduplicar
    unique_papers = deduplicate_papers(all_papers)
    print(f"[*] Total únicos consolidados: {len(unique_papers)}")

    # Ordenar: Priorizar citas y presencia de enlaces directos
    unique_papers.sort(key=lambda p: (1 if p.get("scope") == "🇨🇴 Colombia / Local" else 0, p.get("citations", 0)), reverse=True)

    return unique_papers


# ==============================================================================
# EJECUCIÓN DIRECTA
# ==============================================================================
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Buscador Académico para Tesis de Baterías de Ion de Litio (OpenAlex, Crossref, arXiv)")
    parser.add_argument("--tema", type=str, default="lithium ion battery second life BMS SoH SoC estimation", help="Tema o palabras clave")
    parser.add_argument("-n", "--num", type=int, default=15, help="Resultados por API (default 15)")
    parser.add_argument("--desde", type=int, default=2019, help="Año mínimo (default 2019)")
    parser.add_argument("-o", "--output", type=str, default="resultados.md", help="Archivo de salida Markdown")

    args = parser.parse_args()

    results = search_all_sources(args.tema, limit_per_source=args.num, from_year=args.desde)

    # Exportar en los 3 formatos
    export_markdown(results, args.output, args.tema)
    generate_bibtex(results, "referencias.bib")

    with open("resultados.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # Exportar directo para la web de ForoMagma
    js_output_path = os.path.join(os.path.dirname(__file__), "..", "js", "papers_data.js")
    export_for_foromagma(results, js_output_path)

    print(f"\n[OK] Exportacion completada con exito:")
    print(f"  - Markdown: {args.output}")
    print(f"  - BibTeX: referencias.bib")
    print(f"  - JSON: resultados.json")
    print(f"  - ForoMagma Web DB: {js_output_path}")
