# class: FormData
* langs: java

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
- returns: <[FormData]>

Creates new instance of [FormData].

## method: FormData.set
- returns: <[FormData]>

Sets a field on the form. File values can be passed either as `Path` or as `FilePayload`.

### param: FormData.set.name
- `name` <[string]>

Field name.

### param: FormData.set.value
- `value` <[string]|[boolean]|[int]|[Path]|[Object]>
  - `name` <[string]> File name
  - `mimeType` <[string]> File type
  - `buffer` <[Buffer]> File content

Field value.
