send_telegram_message() {
  if [[ -z $TELEGRAM_BOT_KEY ]]; then
    return;
  fi
  if ! command -v curl >/dev/null; then
    return;
  fi
  local TEXT=${1//\"/\\\"}
  curl --silent \
       -X POST \
       -H 'Content-Type: application/json' \
       -d '{"disable_web_page_preview": true, "chat_id": "-1001225613794", "parse_mode": "html", "text": "'"$TEXT"'", "disable_notification": false}' \
       https://api.telegram.org/bot$TELEGRAM_BOT_KEY/sendMessage >/dev/null
}
