module.exports["toThrowError substring did not throw at all"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected substring: <g>"apple"</>

Received function did not throw`;

module.exports["toThrowError substring threw, but message did not match (error)"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected substring: <g>"banana"</>
Received message:   <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError substring threw, but message did not match (non-error falsey)"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected substring: <g>"Server Error"</>
Received value:     <r>""</>
`;

module.exports["toThrowError substring threw, but message should not match (error)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected substring: not <g>"array"</>
Received message:       <r>"Invalid <i>array</i> length"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError substring threw, but message should not match (non-error truthy)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected substring: not <g>"Server Error"</>
Received value:         <r>"Internal Server Error"</>
`;

module.exports["toThrowError regexp did not throw at all"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected pattern: <g>/apple/</>

Received function did not throw`;

module.exports["toThrowError regexp threw, but message did not match (error)"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected pattern: <g>/banana/</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError regexp threw, but message did not match (non-error falsey)"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected pattern: <g>/^[123456789]\\d*/</>
Received value:   <r>0</>
`;

module.exports["toThrowError regexp threw, but message should not match (error)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected pattern: not <g>/ array /</>
Received message:     <r>"Invalid<i> array </i>length"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError regexp threw, but message should not match (non-error truthy)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected pattern: not <g>/^[123456789]\\d*/</>
Received value:       <r>404</>
`;

module.exports["toThrowError error class did not throw at all"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected constructor: <g>Err</>

Received function did not throw`;

module.exports["toThrowError error class threw, but class did not match (error)"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected constructor: <g>Err2</>
Received constructor: <r>Err</>

Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError error class threw, but class did not match (non-error falsey)"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected constructor: <g>Err2</>

Received value: <r>undefined</>
`;

module.exports["toThrowError error class threw, but class should not match (error)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected constructor: not <g>Err</>

Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError error class threw, but class should not match (error subclass)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected constructor: not <g>Err</>
Received constructor:     <r>SubErr</> extends <g>Err</>

Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError error class threw, but class should not match (error subsubclass)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected constructor: not <g>Err</>
Received constructor:     <r>SubSubErr</> extends … extends <g>Err</>

Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError error-message fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected message: <g>"apple"</>
Received message: <r>"banana"</>
`;

module.exports["toThrowError error-message fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected message: not <g>"Invalid array length"</>
`;

module.exports["toThrowError error-message fail multiline diff highlight incorrect expected space"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

<g>- Expected message  - 1</>
<r>+ Received message  + 1</>

<g>- There is no route defined for key Settings.<i> </i></>
<r>+ There is no route defined for key Settings.</>
<d>  Must be one of: 'Home'</>
`;

module.exports["toThrowError asymmetric any-Class fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: <g>Any<Err2></>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError asymmetric any-Class fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: not <g>Any<Err></>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError asymmetric anything fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: <g>Anything</>

Thrown value: <r>null</>
`;

module.exports["toThrowError asymmetric anything fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: not <g>Anything</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError asymmetric no-symbol fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: <g>{"asymmetricMatch": [Function asymmetricMatch]}</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError asymmetric no-symbol fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: not <g>{"asymmetricMatch": [Function asymmetricMatch]}</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError asymmetric objectContaining fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: <g>ObjectContaining {"name": "NotError"}</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError asymmetric objectContaining fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: not <g>ObjectContaining {"name": "Error"}</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrowError promise/async throws if Error-like object is returned did not throw at all"] = `callback is not a function`;

module.exports["toThrowError promise/async throws if Error-like object is returned threw, but class did not match"] = `callback is not a function`;

module.exports["toThrowError promise/async throws if Error-like object is returned threw, but should not have"] = `callback is not a function`;

module.exports["toThrowError expected is undefined threw, but should not have (non-error falsey)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>()</>

Thrown value: <r>null</>
`;

module.exports["toThrowError invalid arguments"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrowError<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a string or regular expression or class or error

Expected has type:  number
Expected has value: <g>111</>`;

module.exports["toThrowError invalid actual"] = `<d>expect(</><r>received</><d>).</>toThrowError<d>()</>

<b>Matcher error</>: <r>received</> value must be a function

Received has type:  string
Received has value: <r>"a string"</>`;

module.exports["toThrow substring did not throw at all"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected substring: <g>"apple"</>

Received function did not throw`;

module.exports["toThrow substring threw, but message did not match (error)"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected substring: <g>"banana"</>
Received message:   <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow substring threw, but message did not match (non-error falsey)"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected substring: <g>"Server Error"</>
Received value:     <r>""</>
`;

module.exports["toThrow substring threw, but message should not match (error)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected substring: not <g>"array"</>
Received message:       <r>"Invalid <i>array</i> length"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow substring threw, but message should not match (non-error truthy)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected substring: not <g>"Server Error"</>
Received value:         <r>"Internal Server Error"</>
`;

module.exports["toThrow regexp did not throw at all"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected pattern: <g>/apple/</>

Received function did not throw`;

module.exports["toThrow regexp threw, but message did not match (error)"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected pattern: <g>/banana/</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow regexp threw, but message did not match (non-error falsey)"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected pattern: <g>/^[123456789]\\d*/</>
Received value:   <r>0</>
`;

module.exports["toThrow regexp threw, but message should not match (error)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected pattern: not <g>/ array /</>
Received message:     <r>"Invalid<i> array </i>length"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow regexp threw, but message should not match (non-error truthy)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected pattern: not <g>/^[123456789]\\d*/</>
Received value:       <r>404</>
`;

module.exports["toThrow error class did not throw at all"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected constructor: <g>Err</>

Received function did not throw`;

module.exports["toThrow error class threw, but class did not match (error)"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected constructor: <g>Err2</>
Received constructor: <r>Err</>

Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow error class threw, but class did not match (non-error falsey)"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected constructor: <g>Err2</>

Received value: <r>undefined</>
`;

module.exports["toThrow error class threw, but class should not match (error)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected constructor: not <g>Err</>

Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow error class threw, but class should not match (error subclass)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected constructor: not <g>Err</>
Received constructor:     <r>SubErr</> extends <g>Err</>

Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow error class threw, but class should not match (error subsubclass)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected constructor: not <g>Err</>
Received constructor:     <r>SubSubErr</> extends … extends <g>Err</>

Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow error-message fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected message: <g>"apple"</>
Received message: <r>"banana"</>
`;

module.exports["toThrow error-message fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected message: not <g>"Invalid array length"</>
`;

module.exports["toThrow error-message fail multiline diff highlight incorrect expected space"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

<g>- Expected message  - 1</>
<r>+ Received message  + 1</>

<g>- There is no route defined for key Settings.<i> </i></>
<r>+ There is no route defined for key Settings.</>
<d>  Must be one of: 'Home'</>
`;

module.exports["toThrow asymmetric any-Class fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: <g>Any<Err2></>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow asymmetric any-Class fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: not <g>Any<Err></>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow asymmetric anything fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: <g>Anything</>

Thrown value: <r>null</>
`;

module.exports["toThrow asymmetric anything fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: not <g>Anything</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow asymmetric no-symbol fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: <g>{"asymmetricMatch": [Function asymmetricMatch]}</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow asymmetric no-symbol fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: not <g>{"asymmetricMatch": [Function asymmetricMatch]}</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow asymmetric objectContaining fail isNot false"] = `<d>expect(</><r>received</><d>).</>toThrow<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: <g>ObjectContaining {"name": "NotError"}</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow asymmetric objectContaining fail isNot true"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

Expected asymmetric matcher: not <g>ObjectContaining {"name": "Error"}</>

Received name:    <r>"Error"</>
Received message: <r>"apple"</>

      <d>at expectUnderTest (</>packages/expect/src/__tests__/toThrowMatchers-test.js<d>:24:74)</>`;

module.exports["toThrow promise/async throws if Error-like object is returned did not throw at all"] = `callback is not a function`;

module.exports["toThrow promise/async throws if Error-like object is returned threw, but class did not match"] = `callback is not a function`;

module.exports["toThrow promise/async throws if Error-like object is returned threw, but should not have"] = `callback is not a function`;

module.exports["toThrow expected is undefined threw, but should not have (non-error falsey)"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>()</>

Thrown value: <r>null</>
`;

module.exports["toThrow invalid arguments"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toThrow<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a string or regular expression or class or error

Expected has type:  number
Expected has value: <g>111</>`;

module.exports["toThrow invalid actual"] = `<d>expect(</><r>received</><d>).</>toThrow<d>()</>

<b>Matcher error</>: <r>received</> value must be a function

Received has type:  string
Received has value: <r>"a string"</>`;

