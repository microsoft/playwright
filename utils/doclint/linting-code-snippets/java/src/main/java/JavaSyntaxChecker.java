import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.github.javaparser.JavaParser;
import com.github.javaparser.Problem;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;

import java.io.FileReader;
import java.io.IOException;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class JavaSyntaxChecker {
    public static void main(String[] args) {
        if (args.length == 0) {
            System.out.println("Error: Please provide the path to the JSON file");
            return;
        }

        String codeSnippetsPath = args[args.length - 1];
        List<CodeSnippet> codeSnippets = readCodeSnippets(codeSnippetsPath);
        if (codeSnippets == null) {
            System.out.println("Error: codeSnippets is null");
            return;
        }

        List<Map<String, Object>> output = new ArrayList<>();

        ParserConfiguration config = new ParserConfiguration();
        config.setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_17);

        for (CodeSnippet codeSnippet : codeSnippets) {
            String cleanedCode = cleanSnippet(codeSnippet.code);
            ParseResult<CompilationUnit> parseResult = new JavaParser(config).parse(cleanedCode);
            List<Problem> syntaxErrors = parseResult.getProblems();

            if (!syntaxErrors.isEmpty()) {
                output.add(Map.of(
                    "status", "error",
                    "error", String.join("\n", syntaxErrors.stream()
                            .map(Problem::getMessage)
                            .collect(Collectors.toList()))
                ));
            } else {
                output.add(Map.of("status", "ok"));
            }
        }

        System.out.println(new Gson().toJson(output));
    }

    private static String removeImports(String code) {
        // Remove import statements
        return Pattern.compile("^import.*;$", Pattern.MULTILINE)
                      .matcher(code)
                      .replaceAll("");
    }

    private static String cleanSnippet(String code) {
        // if it contains "public class" then it's a full class, return immediately
        if (code.contains("public class")) {
            return code;
        }
        code = removeImports(code);
        String wrappedCode = """
            import com.microsoft.playwright.*;
            import static com.microsoft.playwright.assertions.PlaywrightAssertions.*;
            
            public class Example {
                public static void main(String[] args) {
                    try (Playwright playwright = Playwright.create()) {
                        Browser browser = playwright.chromium().launch();
                        BrowserContext context = browser.newContext();
                        Page page = context.newPage();
                        %s
                    }
                }
            }
            """.formatted(code);
        return wrappedCode;
    }

    private static List<CodeSnippet> readCodeSnippets(String filePath) {
        try (FileReader reader = new FileReader(filePath)) {
            Type listType = new TypeToken<ArrayList<CodeSnippet>>(){}.getType();
            return new Gson().fromJson(reader, listType);
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        }
    }
}

class CodeSnippet {
    String filePath;
    String codeLang;
    String code;

    public CodeSnippet(String filePath, String codeLang, String code) {
        this.filePath = filePath;
        this.codeLang = codeLang;
        this.code = code;
    }
}