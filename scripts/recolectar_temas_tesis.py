#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recolector Especializado de Literatura para Tesis de Baterías de Ion de Litio.
Busca y clasifica publicaciones de OpenAlex y Crossref sobre:
1. Segunda vida de baterías
2. BMS para segunda vida
3. BMS actuales y estándares (IEC, ISO, IEEE)
4. Estimación de SoH (State of Health)
5. Medición y algoritmos de SoC (State of Charge)
6. Carga rápida y degradación
7. Investigaciones en Colombia / Latinoamérica y Global
"""

import os
import sys
import json
import time
from buscador_academico import (
    search_all_sources,
    deduplicate_papers,
    export_markdown,
    generate_bibtex,
    export_for_foromagma
)

TOPICS_MAP = {
    "Segunda Vida": "second life lithium ion battery repurposing circular economy",
    "BMS Segunda Vida": "battery management system BMS second life batteries reconditioning",
    "BMS Estándares": "battery management system BMS standards ISO 26262 IEC 62619 IEEE",
    "SoH (Salud)": "lithium ion battery State of Health SoH estimation machine learning kalman filter",
    "SoC (Carga)": "lithium ion battery State of Charge SoC estimation coulomb counting open circuit voltage",
    "Carga Rápida": "lithium ion battery fast charging degradation thermal cycle life testing",
    "Colombia / LatAm": "lithium ion battery Colombia Latin America renewable energy storage"
}

def main():
    print("[*] Iniciando recoleccion bibliografica especializada para Tesis de Baterias...")
    all_papers = []

    for category, query in TOPICS_MAP.items():
        print(f"\n---> Consultando categoria: [{category}] (query: {query})")
        results = search_all_sources(query, limit_per_source=8, from_year=2010)
        for r in results:
            r["thesis_category"] = category
        all_papers.extend(results)
        time.sleep(1) # Respetar rate limits

    # Deduplicar globalmente
    unique_papers = deduplicate_papers(all_papers)
    print(f"\n[OK] Total de articulos unicos recolectados: {len(unique_papers)}")

    # Ordenar de más actual a más antiguo (año descendente; si empatan, por citas)
    unique_papers.sort(key=lambda p: (int(p.get("year") or 0), p.get("citations", 0)), reverse=True)

    # Exportar
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    md_path = os.path.join(base_dir, "resultados_tesis_baterias.md")
    bib_path = os.path.join(base_dir, "referencias_tesis_baterias.bib")
    json_path = os.path.join(base_dir, "resultados_tesis_baterias.json")
    js_path = os.path.join(base_dir, "js", "papers_data.js")

    export_markdown(unique_papers, md_path, "Baterías de Ion de Litio: Segunda Vida, BMS, SoH, SoC y Carga Rápida")
    generate_bibtex(unique_papers, bib_path)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(unique_papers, f, indent=2, ensure_ascii=False)

    export_for_foromagma(unique_papers, js_path)

    print("\n[OK] Generacion completa de archivos de investigacion:")
    print(f"  -> Markdown: {md_path}")
    print(f"  -> BibTeX: {bib_path}")
    print(f"  -> JSON: {json_path}")
    print(f"  -> Base de Datos Web (ForoMagma): {js_path}")

if __name__ == "__main__":
    main()
