"""Gandalf Playbook client — consume learned gift lessons from the Gandalf Protocol.

Reviewed drop-in (see gandalf-protocol `integration/BROFLO-DROPIN.md`). OFF by default and
fails closed: returns nothing if the flag is off, the fetch fails, or the playbook isn't
`ready_for_prod` (uncalibrated). So it's safe to merge inert — it activates only once
Gandalf's gift curve is gated true AND `PLAYBOOK_ENABLED=true` is set in the environment.
"""
import os, json, urllib.request

GANDALF_URL = os.environ.get("GANDALF_URL", "https://ca-gandalf-protocol.wittyflower-1831f2a2.westus2.azurecontainerapps.io")
GANDALF_DOMAIN = os.environ.get("GANDALF_DOMAIN", "gifts")   # Broflo=gifts, fantasy app=fantasy-football, travel app=travel
PLAYBOOK_ENABLED = os.environ.get("PLAYBOOK_ENABLED", "false").lower() == "true"


def fetch_playbook() -> dict | None:
    """Fetch the current Gandalf playbook for THIS app's domain. Returns None on any failure."""
    if not PLAYBOOK_ENABLED:
        return None
    try:
        with urllib.request.urlopen(f"{GANDALF_URL}/api/playbook?domain={GANDALF_DOMAIN}", timeout=3) as r:
            pb = json.load(r)
        return pb if pb.get("ready_for_prod") else None   # HARD gate — uncalibrated => ignore
    except Exception:
        return None


def lessons_block(profile: dict, k: int = 6) -> str:
    """Top-k relevant lessons as a prompt block; '' if disabled/ungated/unavailable."""
    pb = fetch_playbook()
    if not pb or not pb.get("lessons"):
        return ""
    # simple lexical relevance; swap for embeddings later
    words = {w.lower() for v in profile.values() if isinstance(v, str) for w in v.split()}
    ranked = sorted(pb["lessons"],
                    key=lambda l: (len(words & set(l["text"].lower().split())), l.get("confidence", 0)),
                    reverse=True)
    return "\n".join(f"- {l['text']}" for l in ranked[:k])
