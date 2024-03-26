# class: FormData
* since: v1.18
* langs: java, csharp

The [FormData] is used create form data that is sent via [APIRequestContext].

```java
import com.microsoft.playwright.options.FormData;
...
FormData form = FormData.create()
    .set("firstName", "John")
    .set("lastName", "Doe")
    .set("age", 30);
page.request().post("http://localhost/submit", RequestOptions.create().setForm(form));
```

## method: FormData.create
* since: v1.18
* langs: java
- returns: <[FormData]>

Creates new instance of [FormData].

## method: FormData.set
* since: v1.18
- returns: <[FormData]>

Sets a field on the form. File values can be passed either as `Path` or as `FilePayload`.

```java
import com.microsoft.playwright.options.FormData;
...
FormData form = FormData.create()
    // Only name and value are set.
    .set("firstName", "John")
    // Name and value are set, filename and Content-Type are inferred from the file path.
    .set("profilePicture1", Paths.get("john.jpg"))
    // Name, value, filename and Content-Type are set.
    .set("profilePicture2", new FilePayload("john.jpg", "image/jpeg", Files.readAllBytes(Paths.get("john.jpg"))));
    .set("age", 30);
page.request().post("http://localhost/submit", RequestOptions.create().setForm(form));
```

```csharp
var multipart = Context.APIRequest.CreateFormData();
// Only name and value are set.
multipart.Set("firstName", "John");
// Name, value, filename and Content-Type are set.
multipart.Set("profilePicture", new FilePayload()
{
    Name = "john.jpg",
    MimeType = "image/jpeg",
    Buffer = File.ReadAllBytes("john.jpg")
});
await Page.APIRequest.PostAsync("https://localhost/submit", new() { Multipart = multipart });
```

### param: FormData.set.name
* since: v1.18
- `name` <[string]>

Field name.

### param: FormData.set.value
* since: v1.18
- `value` <[string]|[boolean]|[int]|[Path]|[Object]>
  - `name` <[string]> File name
  - `mimeType` <[string]> File type
  - `buffer` <[Buffer]> File content

Field value.

### param: FormData.set.value
* since: v1.18
* langs: csharp
- `value` <[string]|[boolean]|[int]|[Object]>
  - `name` <[string]> File name
  - `mimeType` <[string]> File type
  - `buffer` <[Buffer]> File content

Field value.
