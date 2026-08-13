#!/bin/zsh
set -euo pipefail

script_dir=${0:A:h}
repo_root=${script_dir:h:h:h}
package_root=${script_dir:h}
app_dir="$repo_root/build/Gajendra.app"
icon_source="$repo_root/plugins/gajendra/assets/gajendra-icon.png"
icon_vector="$repo_root/plugins/gajendra/assets/gajendra-app-icon.svg"
menu_bar_icon="$repo_root/plugins/gajendra/assets/gajendra-menubar.svg"
iconset_dir="$repo_root/build/Gajendra.iconset"
icon_file="$repo_root/build/Gajendra.icns"

cd "$repo_root"
npm run build
swift build --package-path "$package_root" -c release --product Gajendra

/bin/rm -rf "$app_dir" "$iconset_dir"
mkdir -p "$app_dir/Contents/MacOS" "$app_dir/Contents/Resources"
/bin/mkdir -p "$iconset_dir"
/usr/bin/sips -s format png -z 1024 1024 "$icon_vector" --out "$icon_source" >/dev/null
/usr/bin/sips -s format png -z 16 16 "$icon_source" --out "$iconset_dir/icon_16x16.png" >/dev/null
/usr/bin/sips -s format png -z 32 32 "$icon_source" --out "$iconset_dir/icon_16x16@2x.png" >/dev/null
/usr/bin/sips -s format png -z 32 32 "$icon_source" --out "$iconset_dir/icon_32x32.png" >/dev/null
/usr/bin/sips -s format png -z 64 64 "$icon_source" --out "$iconset_dir/icon_32x32@2x.png" >/dev/null
/usr/bin/sips -s format png -z 128 128 "$icon_source" --out "$iconset_dir/icon_128x128.png" >/dev/null
/usr/bin/sips -s format png -z 256 256 "$icon_source" --out "$iconset_dir/icon_128x128@2x.png" >/dev/null
/usr/bin/sips -s format png -z 256 256 "$icon_source" --out "$iconset_dir/icon_256x256.png" >/dev/null
/usr/bin/sips -s format png -z 512 512 "$icon_source" --out "$iconset_dir/icon_256x256@2x.png" >/dev/null
/usr/bin/sips -s format png -z 512 512 "$icon_source" --out "$iconset_dir/icon_512x512.png" >/dev/null
/usr/bin/sips -s format png -z 1024 1024 "$icon_source" --out "$iconset_dir/icon_512x512@2x.png" >/dev/null
/usr/bin/iconutil -c icns "$iconset_dir" -o "$icon_file"
/usr/bin/install -m 0755 "$package_root/.build/release/Gajendra" "$app_dir/Contents/MacOS/Gajendra"
/usr/bin/install -m 0644 "$package_root/Resources/Info.plist" "$app_dir/Contents/Info.plist"
/usr/bin/install -m 0644 "$icon_file" "$app_dir/Contents/Resources/Gajendra.icns"
/usr/bin/install -m 0644 "$menu_bar_icon" "$app_dir/Contents/Resources/GajendraMenuBar.svg"
/usr/bin/install -m 0644 "$repo_root/plugins/gajendra/dist/server.mjs" "$app_dir/Contents/Resources/server.mjs"
/usr/bin/codesign --force --deep --sign - "$app_dir"
/usr/bin/codesign --verify --deep --strict "$app_dir"

echo "$app_dir"
