#!/usr/bin/env bash
# =============================================================================
# find_app.sh  —  Finds the latest built SayIt.app in Xcode DerivedData
#                 and prints the path to paste into your .env
# =============================================================================
APP_NAME="App"   # Xcode target name — change if yours is different

echo "Searching for $APP_NAME.app in DerivedData..."
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData \
  -name "${APP_NAME}.app" \
  \( -path "*/Debug-iphonesimulator/*" -o -path "*/Release-iphonesimulator/*" \) \
  2>/dev/null | sort | tail -1)

if [ -z "$APP_PATH" ]; then
  echo ""
  echo "❌  App not found. Make sure you have:"
  echo "   1. Opened the ios/App/App.xcworkspace in Xcode"
  echo "   2. Selected 'Any iOS Simulator Device' as the build target"
  echo "   3. Run Product → Build (⌘B)"
  exit 1
fi

echo ""
echo "✅  Found app at:"
echo "   $APP_PATH"
echo ""
echo "Add this to your appium_tests/.env:"
echo "   IOS_APP_PATH=$APP_PATH"
echo ""

# Auto-update .env if it exists
if [ -f ".env" ]; then
  if grep -q "^IOS_APP_PATH=" .env; then
    sed -i '' "s|^IOS_APP_PATH=.*|IOS_APP_PATH=$APP_PATH|" .env
    echo "✅  Updated IOS_APP_PATH in .env automatically"
  else
    echo "IOS_APP_PATH=$APP_PATH" >> .env
    echo "✅  Appended IOS_APP_PATH to .env"
  fi
fi
