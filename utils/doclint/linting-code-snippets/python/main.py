import json
import sys
import black

def check_code_snippet(code_snippet: str):
    try:
        formatted_code = black.format_str(code_snippet, mode=black.FileMode())
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e),
        }
    if formatted_code.strip() == code_snippet.strip():
        return {
            'status': 'success',
        }
    return {
        'status': 'updated',
        'newCode': formatted_code,
    }


def main():
    code_snippets_path = sys.argv[1]
    if not code_snippets_path:
        print("No code snippets path provided")
        return
    code_snippets = json.load(open(code_snippets_path))
    formatted_codes = [check_code_snippet(snippet["code"]) for snippet in code_snippets]
    print(json.dumps(formatted_codes))


if __name__ == "__main__":
    main()
