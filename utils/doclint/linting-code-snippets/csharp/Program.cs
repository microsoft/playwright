using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

var codeSnippetsPath = args[args.Length - 1];
var codeSnippets = JsonSerializer.Deserialize<List<CodeSnippet>>(File.ReadAllText(codeSnippetsPath));
if (codeSnippets == null)
{
    Console.WriteLine("Error: codeSnippets is null");
    return;
}
var output = new List<object>();

foreach (var codeSnippet in codeSnippets)
{
    var tree = CSharpSyntaxTree.ParseText(codeSnippet.code);
    var syntaxErrors = tree.GetDiagnostics()
        .Where(diag => diag.Severity == DiagnosticSeverity.Error)
        .ToList();
    if (syntaxErrors.Any())
    {
        output.Add(new
        {
            status = "error",
            error = string.Join("\n", syntaxErrors.Select(diag => diag.GetMessage()))
        });
    }
    else
    {
        output.Add(new
        {
            status = "ok"
        });
    }
}

Console.WriteLine(JsonSerializer.Serialize(output));

record CodeSnippet(string filePath, string codeLang, string code);
