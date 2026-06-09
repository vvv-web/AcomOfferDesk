"""Graph RAG: pilot Keycloak «Клиент не найден» — Jun 2026."""
from __future__ import annotations

import logging
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

GRAPHRAG_SCRIPTS = Path.home() / "Desktop/skills/graph-rag/scripts"
sys.path.insert(0, str(GRAPHRAG_SCRIPTS))
logging.basicConfig(level=logging.INFO)

from graph_rag_client import Entity, GraphRAGClient, Relation  # noqa: E402

ENTITY_ID = "acom_k8s_pilot_keycloak_client_not_found_jun2026"
SOURCE = "cursor_session_2026-06-09"


def main() -> None:
    repo = Path(__file__).resolve().parents[4]
    sha = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
    client = GraphRAGClient()
    entity = Entity(
        id=ENTITY_ID,
        name="K8s pilot Keycloak OIDC client not found (acom-web missing)",
        type="Incident",
        properties={
            "symptom": "https://pilot.acom-offer-desk.ru OIDC login → Keycloak «Клиент не найден»",
            "root_cause": "Realm acom-offerdesk without acom-web/acom-api; keycloak-bootstrap Job one-shot; Flux pilot-jobs-bootstrap parallel to pilot-apps",
            "fix_live": "kubectl delete job keycloak-bootstrap && rerun bootstrap (~8m)",
            "fix_git": "pilot-jobs-bootstrap dependsOn pilot-apps; post-deploy-verify OIDC body grep; scripts/rerun-keycloak-bootstrap.sh",
            "git_branch": "k8s-pilot-popos",
            "git_sha": sha,
            "namespace": "acom-offer-desk-pilot",
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        source=SOURCE,
    )
    client.add_entity(entity)
    for rel in (
        Relation(ENTITY_ID, "acom_offer_desk_app", "APPLIES_TO"),
        Relation(ENTITY_ID, "acom_offer_desk_k8s_pilot_popos", "OCCURRED_IN"),
    ):
        client.add_relation(rel)
    print(f"OK: {ENTITY_ID}")


if __name__ == "__main__":
    main()
