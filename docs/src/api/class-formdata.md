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

## method: FormData.append
* since: v1.44
- returns: <[FormData]>

Appends a new value onto an existing key inside a FormData object, or adds the key if it
does not already exist. File values can be passed either as `Path` or as `FilePayload`.
Multiple fields with the same name can be added.

The difference between [`method: FormData.set`] and [`method: FormData.append`] is that if the specified key already exists,
[`method: FormData.set`] will overwrite all existing values with the new one, whereas [`method: FormData.append`] will append
the new value onto the end of the existing set of values.

```java
import com.microsoft.playwright.options.FormData;
...
FormData form = FormData.create()
    // Only name and value are set.
    .append("firstName", "John")
    // Name and value are set, filename and Content-Type are inferred from the file path.
    .append("attachment", Paths.get("pic.jpg"))
    // Name, value, filename and Content-Type are set.
    .append("attachment", new FilePayload("table.csv", "text/csv", Files.readAllBytes(Paths.get("my-tble.csv"))));
page.request().post("http://localhost/submit", RequestOptions.create().setForm(form));
```

```csharp
var multipart = Context.APIRequest.CreateFormData();
// Only name and value are set.
multipart.Append("firstName", "John");
// Name, value, filename and Content-Type are set.
multipart.Append("attachment", new FilePayload()
{
    Name = "pic.jpg",
    MimeType = "image/jpeg",
    Buffer = File.ReadAllBytes("john.jpg")
});
// Name, value, filename and Content-Type are set.
multipart.Append("attachment", new FilePayload()
{
    Name = "table.csv",
    MimeType = "text/csv",
    Buffer = File.ReadAllBytes("my-tble.csv")
});
await Page.APIRequest.PostAsync("https://localhost/submit", new() { Multipart = multipart });
```

### param: FormData.append.name
* since: v1.44
- `name` <[string]>

Field name.

### param: FormData.append.value
* since: v1.44
- `value` <[string]|[boolean]|[int]|[Path]|[Object]>
  - `name` <[string]> File name
  - `mimeType` <[string]> File type
  - `buffer` <[Buffer]> File content

Field value.

### param: FormData.append.value
* since: v1.44
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
