#!/bin/bash
URL="http://127.0.0.1:8989"

while true; do
    killall Dock 2>/dev/null
    killall Finder 2>/dev/null

    # Clear any "Chrome didn't shut down correctly" prompt
    defaults write com.google.Chrome ExitTypeCrashed -string "Normal"
    defaults write com.google.Chrome ExitedCleanly -bool true

    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --kiosk \
        --incognito \
        --noerrdialogs \
        --disable-pinch \
        --disable-session-crashed-bubble \
        --disable-infobars \
        --overscroll-history-navigation=0 \
        --disable-features=TranslateUI \
        "$URL"
    
    sleep 1
done
