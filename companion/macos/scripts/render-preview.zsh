#!/bin/zsh
set -euo pipefail

script_dir=${0:A:h}
repo_root=${script_dir:h:h:h}
package_root=${script_dir:h}
destination="$repo_root/evidence/companion/gajendra-organizer.png"
card_destination="$repo_root/evidence/companion/gajendra-hover-card.png"
pill_destination="$repo_root/evidence/companion/gajendra-pill.png"
dark_destination="$repo_root/evidence/companion/gajendra-organizer-dark.png"
dark_card_destination="$repo_root/evidence/companion/gajendra-hover-card-dark.png"
dark_pill_destination="$repo_root/evidence/companion/gajendra-pill-dark.png"
focus_destination="$repo_root/evidence/companion/gajendra-focus-deck-organizer.png"
focus_card_destination="$repo_root/evidence/companion/gajendra-focus-deck-hover-card.png"
focus_pill_destination="$repo_root/evidence/companion/gajendra-focus-deck-pill.png"
focus_dark_destination="$repo_root/evidence/companion/gajendra-focus-deck-organizer-dark.png"
focus_dark_card_destination="$repo_root/evidence/companion/gajendra-focus-deck-hover-card-dark.png"
focus_dark_pill_destination="$repo_root/evidence/companion/gajendra-focus-deck-pill-dark.png"
compact_card_destination="$repo_root/evidence/companion/gajendra-hover-card-compact.png"
expanded_card_destination="$repo_root/evidence/companion/gajendra-hover-card-expanded.png"
search_card_destination="$repo_root/evidence/companion/gajendra-hover-card-search.png"
onboarding_destination="$repo_root/evidence/companion/gajendra-source-onboarding.png"
dark_onboarding_destination="$repo_root/evidence/companion/gajendra-source-onboarding-dark.png"
queue_editing_destination="$repo_root/evidence/companion/gajendra-hover-card-queue-editing.png"
busy_card_destination="$repo_root/evidence/companion/gajendra-hover-card-busy.png"
one_review_destination="$repo_root/evidence/companion/gajendra-hover-card-review-one.png"
empty_review_destination="$repo_root/evidence/companion/gajendra-hover-card-review-empty.png"
ten_review_destination="$repo_root/evidence/companion/gajendra-hover-card-review-ten-dark-static.png"

mkdir -p "${destination:h}"
swift run --package-path "$package_root" -c release GajendraPreview \
  "$destination" "$card_destination" "$pill_destination" \
  "$dark_destination" "$dark_card_destination" "$dark_pill_destination" \
  "$focus_destination" "$focus_card_destination" "$focus_pill_destination" \
  "$focus_dark_destination" "$focus_dark_card_destination" "$focus_dark_pill_destination" \
  "$compact_card_destination" "$expanded_card_destination" "$search_card_destination" \
  "$onboarding_destination" "$dark_onboarding_destination" "$queue_editing_destination" \
  "$busy_card_destination" "$one_review_destination" "$empty_review_destination" \
  "$ten_review_destination"
echo "$destination"
echo "$card_destination"
echo "$pill_destination"
echo "$dark_destination"
echo "$dark_card_destination"
echo "$dark_pill_destination"
echo "$focus_destination"
echo "$focus_card_destination"
echo "$focus_pill_destination"
echo "$focus_dark_destination"
echo "$focus_dark_card_destination"
echo "$focus_dark_pill_destination"
echo "$compact_card_destination"
echo "$expanded_card_destination"
echo "$search_card_destination"
echo "$onboarding_destination"
echo "$dark_onboarding_destination"
echo "$queue_editing_destination"
echo "$busy_card_destination"
echo "$one_review_destination"
echo "$empty_review_destination"
echo "$ten_review_destination"
