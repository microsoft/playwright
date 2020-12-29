$version = & node -p "require('../../package.json').version"
az storage blob upload -c builds --account-key $env:AZ_ACCOUNT_KEY --account-name $env:AZ_ACCOUNT_NAME -f output\playwright-$version-win32.zip -n "$env:AZ_UPLOAD_FOLDER\playwright-$version-win32.zip"
