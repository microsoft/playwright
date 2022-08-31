namespace webview2;

public partial class Form1 : Form
{
    public Form1()
    {
        InitializeComponent();
        this.webView.CoreWebView2InitializationCompleted += (_, e) =>
        {
            if (e.IsSuccess)
              Console.WriteLine("WebView2 initialized");
        };
    }
}
