"""Post-processing pipeline for AI suggestions."""

from Levenshtein import distance as levenshtein_distance

from .schemas import SuggestionItem, SuggestRequest
from .prompt import BLOCKLIST_CATEGORIES


def _fuzzy_match(a: str, b: str, threshold: int = 3) -> bool:
    """Check if two strings are within Levenshtein distance threshold."""
    return levenshtein_distance(a.lower().strip(), b.lower().strip()) < threshold


def filter_budget(
    suggestions: list[SuggestionItem],
    budget_max_cents: int,
) -> tuple[list[SuggestionItem], int]:
    """Remove suggestions exceeding budget (10% overage tolerance)."""
    ceiling = int(budget_max_cents * 1.1)
    kept = []
    filtered = 0
    for s in suggestions:
        if s.estimated_price_max_cents > ceiling:
            filtered += 1
        else:
            kept.append(s)
    return kept, filtered


def filter_never_again(
    suggestions: list[SuggestionItem],
    never_again: list[str],
) -> tuple[list[SuggestionItem], int]:
    """Remove suggestions matching never-again items (fuzzy match)."""
    if not never_again:
        return suggestions, 0
    kept = []
    filtered = 0
    for s in suggestions:
        matched = any(_fuzzy_match(s.title, na) for na in never_again)
        if matched:
            filtered += 1
        else:
            kept.append(s)
    return kept, filtered


def filter_gift_history(
    suggestions: list[SuggestionItem],
    history_titles: list[str],
) -> tuple[list[SuggestionItem], int]:
    """Remove suggestions matching recent gift history (fuzzy match)."""
    if not history_titles:
        return suggestions, 0
    kept = []
    filtered = 0
    for s in suggestions:
        matched = any(_fuzzy_match(s.title, h) for h in history_titles)
        if matched:
            filtered += 1
        else:
            kept.append(s)
    return kept, filtered


def filter_blocklist(
    suggestions: list[SuggestionItem],
) -> tuple[list[SuggestionItem], int]:
    """Remove suggestions containing blocklisted content."""
    kept = []
    filtered = 0
    for s in suggestions:
        text = f"{s.title} {s.description}".lower()
        if any(cat in text for cat in BLOCKLIST_CATEGORIES):
            filtered += 1
        else:
            kept.append(s)
    return kept, filtered


def rank_suggestions(
    suggestions: list[SuggestionItem],
    bold: bool = False,
) -> list[SuggestionItem]:
    """Sort suggestions by composite score."""
    if bold:
        key = lambda s: (s.delight_score * 0.3) + (s.novelty_score * 0.7)
    else:
        key = lambda s: (s.delight_score * 0.6) + (s.novelty_score * 0.4)
    return sorted(suggestions, key=key, reverse=True)


def run_pipeline(
    suggestions: list[SuggestionItem],
    req: SuggestRequest,
) -> tuple[list[SuggestionItem], int]:
    """Run the full post-processing pipeline. Returns (filtered_suggestions, total_filtered)."""
    total_filtered = 0

    # 1. Budget check
    suggestions, n = filter_budget(suggestions, req.budget_max_cents)
    total_filtered += n

    # 2. Never-again fuzzy match
    na_descriptions = [na.description for na in req.never_again]
    suggestions, n = filter_never_again(suggestions, na_descriptions)
    total_filtered += n

    # 3. Gift history fuzzy match
    history_titles = [g.title for g in req.gift_history]
    suggestions, n = filter_gift_history(suggestions, history_titles)
    total_filtered += n

    # 4. Blocklist check
    suggestions, n = filter_blocklist(suggestions)
    total_filtered += n

    # 5. Re-rank
    bold = req.surprise_factor.value == "bold"
    suggestions = rank_suggestions(suggestions, bold=bold)

    return suggestions, total_filtered
