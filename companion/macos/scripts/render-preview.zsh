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

mkdir -p "${destination:h}"
swift run --package-path "$package_root" -c release GajendraPreview \
  "$destination" "$card_destination" "$pill_destination" \
  "$dark_destination" "$dark_card_destination" "$dark_pill_destination"
echo "$destination"
echo "$card_destination"
echo "$pill_destination"
echo "$dark_destination"
echo "$dark_card_destination"
echo "$dark_pill_destination"
