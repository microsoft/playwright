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

## method: FormData.add
* since: v1.43
- returns: <[FormData]>

Adds a field to the form. File values can be passed either as `Path` or as `FilePayload`.
Multiple fields with the same name can be added.

```java
import com.microsoft.playwright.options.FormData;
...
FormData form = FormData.create()
    // Only name and value are set.
    .add("firstName", "John")
    // Name and value are set, filename and Content-Type are inferred from the file path.
    .add("attachment", Paths.get("pic.jpg"))
    // Name, value, filename and Content-Type are set.
    .add("attachment", new FilePayload("table.csv", "text/csv", Files.readAllBytes(Paths.get("my-tble.csv"))));
page.request().post("http://localhost/submit", RequestOptions.create().setForm(form));
```

```csharp
var multipart = Context.APIRequest.CreateFormData();
// Only name and value are set.
multipart.Add("firstName", "John");
// Name, value, filename and Content-Type are set.
multipart.Add("attachment", new FilePayload()
{
    Name = "pic.jpg",
    MimeType = "image/jpeg",
    Buffer = File.ReadAllBytes("john.jpg")
});
// Name, value, filename and Content-Type are set.
multipart.Add("attachment", new FilePayload()
{
    Name = "table.csv",
    MimeType = "text/csv",
    Buffer = File.ReadAllBytes("my-tble.csv")
});
await Page.APIRequest.PostAsync("https://localhost/submit", new() { Multipart = multipart });
```

### param: FormData.add.name
* since: v1.43
- `name` <[string]>

Field name.

### param: FormData.add.value
* since: v1.43
- `value` <[string]|[boolean]|[int]|[Path]|[Object]>
  - `name` <[string]> File name
  - `mimeType` <[string]> File type
  - `buffer` <[Buffer]> File content

Field value.

### param: FormData.add.value
* since: v1.43
* langs: csharp
- `value` <[string]|[boolean]|[int]|[Object]>
  - `name` <[string]> File name
  - `mimeType` <[string]> File type
  - `buffer` <[Buffer]> File content

Field value.

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
    .set("profilePicture2", new FilePayload("john.jpg", "image/jpeg", Files.readAllBytes(Paths.get("john.jpg"))))
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
multipart.Set("age", 30);
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
