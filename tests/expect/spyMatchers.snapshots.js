module.exports["toBeCalled works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toBeCalled<d>()</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toBeCalled passes when called"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toBeCalled<d>()</>

Expected number of calls: <g>0</>
Received number of calls: <r>1</>

1: <r>"arg0"</>, <r>"arg1"</>, <r>"arg2"</>`;

module.exports["toBeCalled .not passes when called"] = `<d>expect(</><r>spy</><d>).</>toBeCalled<d>()</>

Expected number of calls: >= <g>1</>
Received number of calls:    <r>0</>`;

module.exports["toBeCalled fails with any argument passed"] = `<d>expect(</><r>received</><d>).</>toBeCalled<d>()</>

<b>Matcher error</>: this matcher must not have an expected argument

Expected has type:  number
Expected has value: <g>555</>`;

module.exports["toBeCalled .not fails with any argument passed"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toBeCalled<d>()</>

<b>Matcher error</>: this matcher must not have an expected argument

Expected has type:  number
Expected has value: <g>555</>`;

module.exports["toBeCalled includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>toBeCalled<d>()</>

Expected number of calls: <g>0</>
Received number of calls: <r>1</>

1: called with 0 arguments`;

module.exports["toHaveBeenCalled works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toHaveBeenCalled<d>()</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toHaveBeenCalled passes when called"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenCalled<d>()</>

Expected number of calls: <g>0</>
Received number of calls: <r>1</>

1: <r>"arg0"</>, <r>"arg1"</>, <r>"arg2"</>`;

module.exports["toHaveBeenCalled .not passes when called"] = `<d>expect(</><r>spy</><d>).</>toHaveBeenCalled<d>()</>

Expected number of calls: >= <g>1</>
Received number of calls:    <r>0</>`;

module.exports["toHaveBeenCalled fails with any argument passed"] = `<d>expect(</><r>received</><d>).</>toHaveBeenCalled<d>()</>

<b>Matcher error</>: this matcher must not have an expected argument

Expected has type:  number
Expected has value: <g>555</>`;

module.exports["toHaveBeenCalled .not fails with any argument passed"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveBeenCalled<d>()</>

<b>Matcher error</>: this matcher must not have an expected argument

Expected has type:  number
Expected has value: <g>555</>`;

module.exports["toHaveBeenCalled includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>toHaveBeenCalled<d>()</>

Expected number of calls: <g>0</>
Received number of calls: <r>1</>

1: called with 0 arguments`;

module.exports["toBeCalledTimes .not works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toBeCalledTimes only accepts a number argument"] = `<d>expect(</><r>received</><d>).</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  object
Expected has value: <g>{}</>`;

module.exports["toBeCalledTimes only accepts a number argument #1"] = `<d>expect(</><r>received</><d>).</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  array
Expected has value: <g>[]</>`;

module.exports["toBeCalledTimes only accepts a number argument #2"] = `<d>expect(</><r>received</><d>).</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  boolean
Expected has value: <g>true</>`;

module.exports["toBeCalledTimes only accepts a number argument #3"] = `<d>expect(</><r>received</><d>).</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  string
Expected has value: <g>"a"</>`;

module.exports["toBeCalledTimes only accepts a number argument #4"] = `<d>expect(</><r>received</><d>).</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  map
Expected has value: <g>Map {}</>`;

module.exports["toBeCalledTimes only accepts a number argument #5"] = `<d>expect(</><r>received</><d>).</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  function
Expected has value: <g>[Function anonymous]</>`;

module.exports["toBeCalledTimes .not only accepts a number argument"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  object
Expected has value: <g>{}</>`;

module.exports["toBeCalledTimes .not only accepts a number argument #1"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  array
Expected has value: <g>[]</>`;

module.exports["toBeCalledTimes .not only accepts a number argument #2"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  boolean
Expected has value: <g>true</>`;

module.exports["toBeCalledTimes .not only accepts a number argument #3"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  string
Expected has value: <g>"a"</>`;

module.exports["toBeCalledTimes .not only accepts a number argument #4"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  map
Expected has value: <g>Map {}</>`;

module.exports["toBeCalledTimes .not only accepts a number argument #5"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toBeCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  function
Expected has value: <g>[Function anonymous]</>`;

module.exports["toBeCalledTimes passes if function called equal to expected times"] = `<d>expect(</><r>spy</><d>).</>not<d>.</>toBeCalledTimes<d>(</><g>expected</><d>)</>

Expected number of calls: not <g>2</>`;

module.exports["toBeCalledTimes .not passes if function called more than expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledTimes<d>(</><g>expected</><d>)</>

Expected number of calls: <g>2</>
Received number of calls: <r>3</>`;

module.exports["toBeCalledTimes .not passes if function called less than expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledTimes<d>(</><g>expected</><d>)</>

Expected number of calls: <g>2</>
Received number of calls: <r>1</>`;

module.exports["toBeCalledTimes includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>toBeCalledTimes<d>(</><g>expected</><d>)</>

Expected number of calls: <g>2</>
Received number of calls: <r>1</>`;

module.exports["toHaveBeenCalledTimes .not works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toHaveBeenCalledTimes only accepts a number argument"] = `<d>expect(</><r>received</><d>).</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  object
Expected has value: <g>{}</>`;

module.exports["toHaveBeenCalledTimes only accepts a number argument #1"] = `<d>expect(</><r>received</><d>).</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  array
Expected has value: <g>[]</>`;

module.exports["toHaveBeenCalledTimes only accepts a number argument #2"] = `<d>expect(</><r>received</><d>).</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  boolean
Expected has value: <g>true</>`;

module.exports["toHaveBeenCalledTimes only accepts a number argument #3"] = `<d>expect(</><r>received</><d>).</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  string
Expected has value: <g>"a"</>`;

module.exports["toHaveBeenCalledTimes only accepts a number argument #4"] = `<d>expect(</><r>received</><d>).</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  map
Expected has value: <g>Map {}</>`;

module.exports["toHaveBeenCalledTimes only accepts a number argument #5"] = `<d>expect(</><r>received</><d>).</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  function
Expected has value: <g>[Function anonymous]</>`;

module.exports["toHaveBeenCalledTimes .not only accepts a number argument"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  object
Expected has value: <g>{}</>`;

module.exports["toHaveBeenCalledTimes .not only accepts a number argument #1"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  array
Expected has value: <g>[]</>`;

module.exports["toHaveBeenCalledTimes .not only accepts a number argument #2"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  boolean
Expected has value: <g>true</>`;

module.exports["toHaveBeenCalledTimes .not only accepts a number argument #3"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  string
Expected has value: <g>"a"</>`;

module.exports["toHaveBeenCalledTimes .not only accepts a number argument #4"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  map
Expected has value: <g>Map {}</>`;

module.exports["toHaveBeenCalledTimes .not only accepts a number argument #5"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  function
Expected has value: <g>[Function anonymous]</>`;

module.exports["toHaveBeenCalledTimes passes if function called equal to expected times"] = `<d>expect(</><r>spy</><d>).</>not<d>.</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

Expected number of calls: not <g>2</>`;

module.exports["toHaveBeenCalledTimes .not passes if function called more than expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

Expected number of calls: <g>2</>
Received number of calls: <r>3</>`;

module.exports["toHaveBeenCalledTimes .not passes if function called less than expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

Expected number of calls: <g>2</>
Received number of calls: <r>1</>`;

module.exports["toHaveBeenCalledTimes includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>toHaveBeenCalledTimes<d>(</><g>expected</><d>)</>

Expected number of calls: <g>2</>
Received number of calls: <r>1</>`;

module.exports["lastCalledWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["lastCalledWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>

Number of calls: <r>0</>`;

module.exports["lastCalledWith works with arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <r>"bar1"</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with arguments that don't match in number of arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <d>"bar"</>, <r>"plop"</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with arguments that don't match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>Any<String></>, <g>Any<Number></>
Received: <d>"foo"</>, <r>"bar"</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with arguments that don't match with matchers even when argument is undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>Any<String></>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with arguments that don't match in size even if one is an optional matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>optionalFn<></>
Received: <d>"foo"</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with arguments that match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with arguments that match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Any<String></>, <g>Any<String></>
Received:     <r>0</>, <r>["foo", "bar"]</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with trailing undefined arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with trailing undefined arguments if requested by the match query"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>undefined</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with trailing undefined arguments when explicitly requested as optional by matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>optionalFn<></>
Received:     <r>0</>, <r>["foo", undefined]</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

<g>- Expected</>
<r>+ Received</>

<d>  Map {</>
<g>-   "a" => "b",</>
<g>-   "b" => "a",</>
<r>+   1 => 2,</>
<r>+   2 => 1,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Set {1, 2}</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

<g>- Expected</>
<r>+ Received</>

<d>  Set {</>
<g>-   3,</>
<g>-   4,</>
<r>+   1,</>
<r>+   2,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with Immutable.js objects"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>, <g>Immutable.Map {"a": {"b": "c"}}</>

Number of calls: <r>1</>`;

module.exports["lastCalledWith works with many arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>
Received
       2:     <d>"foo"</>, <r>"bar1"</>
->     3:     <d>"foo"</>, <d>"bar"</>

Number of calls: <r>3</>`;

module.exports["lastCalledWith works with many arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received
       2: <d>"foo"</>, <r>"bar2"</>
->     3: <d>"foo"</>, <r>"bar3"</>

Number of calls: <r>3</>`;

module.exports["lastCalledWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>lastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toHaveBeenLastCalledWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>

Number of calls: <r>0</>`;

module.exports["toHaveBeenLastCalledWith works with arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <r>"bar1"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with arguments that don't match in number of arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <d>"bar"</>, <r>"plop"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with arguments that don't match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>Any<String></>, <g>Any<Number></>
Received: <d>"foo"</>, <r>"bar"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with arguments that don't match with matchers even when argument is undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>Any<String></>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with arguments that don't match in size even if one is an optional matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>optionalFn<></>
Received: <d>"foo"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with arguments that match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with arguments that match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Any<String></>, <g>Any<String></>
Received:     <r>0</>, <r>["foo", "bar"]</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with trailing undefined arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with trailing undefined arguments if requested by the match query"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>undefined</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with trailing undefined arguments when explicitly requested as optional by matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>optionalFn<></>
Received:     <r>0</>, <r>["foo", undefined]</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

<g>- Expected</>
<r>+ Received</>

<d>  Map {</>
<g>-   "a" => "b",</>
<g>-   "b" => "a",</>
<r>+   1 => 2,</>
<r>+   2 => 1,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Set {1, 2}</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

<g>- Expected</>
<r>+ Received</>

<d>  Set {</>
<g>-   3,</>
<g>-   4,</>
<r>+   1,</>
<r>+   2,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with Immutable.js objects"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>, <g>Immutable.Map {"a": {"b": "c"}}</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenLastCalledWith works with many arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>
Received
       2:     <d>"foo"</>, <r>"bar1"</>
->     3:     <d>"foo"</>, <d>"bar"</>

Number of calls: <r>3</>`;

module.exports["toHaveBeenLastCalledWith works with many arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received
       2: <d>"foo"</>, <r>"bar2"</>
->     3: <d>"foo"</>, <r>"bar3"</>

Number of calls: <r>3</>`;

module.exports["toHaveBeenLastCalledWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>toHaveBeenLastCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["nthCalledWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>"bar"</>

Number of calls: <r>0</>`;

module.exports["nthCalledWith works with arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <r>"bar1"</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with arguments that don't match in number of arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <d>"bar"</>, <r>"plop"</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with arguments that don't match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>Any<String></>, <g>Any<Number></>
Received: <d>"foo"</>, <r>"bar"</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with arguments that don't match with matchers even when argument is undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>Any<String></>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with arguments that don't match in size even if one is an optional matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>optionalFn<></>
Received: <d>"foo"</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with arguments that match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with arguments that match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>Any<String></>, <g>Any<String></>
Received:     <r>0</>, <r>["foo", "bar"]</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with trailing undefined arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with trailing undefined arguments if requested by the match query"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo"</>, <g>undefined</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with trailing undefined arguments when explicitly requested as optional by matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo"</>, <g>optionalFn<></>
Received:     <r>0</>, <r>["foo", undefined]</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
<g>- Expected</>
<r>+ Received</>

<d>  Map {</>
<g>-   "a" => "b",</>
<g>-   "b" => "a",</>
<r>+   1 => 2,</>
<r>+   2 => 1,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>Set {1, 2}</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
<g>- Expected</>
<r>+ Received</>

<d>  Set {</>
<g>-   3,</>
<g>-   4,</>
<r>+   1,</>
<r>+   2,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with Immutable.js objects"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>, <g>Immutable.Map {"a": {"b": "c"}}</>

Number of calls: <r>1</>`;

module.exports["nthCalledWith works with three calls"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo1"</>, <g>"bar"</>
Received
->     1:     <d>"foo1"</>, <d>"bar"</>
       2:     <r>"foo"</>, <r>"bar1"</>

Number of calls: <r>3</>`;

module.exports["nthCalledWith positive throw matcher error for n that is not positive integer"] = `<d>expect(</><r>received</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: 0`;

module.exports["nthCalledWith positive throw matcher error for n that is not integer"] = `<d>expect(</><r>received</><d>).</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: 0.1`;

module.exports["nthCalledWith negative throw matcher error for n that is not integer"] = `<d>expect(</><r>received</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: Infinity`;

module.exports["nthCalledWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>nthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toHaveBeenNthCalledWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>"bar"</>

Number of calls: <r>0</>`;

module.exports["toHaveBeenNthCalledWith works with arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <r>"bar1"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with arguments that don't match in number of arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <d>"bar"</>, <r>"plop"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with arguments that don't match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>Any<String></>, <g>Any<Number></>
Received: <d>"foo"</>, <r>"bar"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with arguments that don't match with matchers even when argument is undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>Any<String></>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with arguments that don't match in size even if one is an optional matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>, <g>optionalFn<></>
Received: <d>"foo"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with arguments that match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with arguments that match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>Any<String></>, <g>Any<String></>
Received:     <r>0</>, <r>["foo", "bar"]</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with trailing undefined arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: <g>"foo"</>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with trailing undefined arguments if requested by the match query"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo"</>, <g>undefined</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with trailing undefined arguments when explicitly requested as optional by matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo"</>, <g>optionalFn<></>
Received:     <r>0</>, <r>["foo", undefined]</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
<g>- Expected</>
<r>+ Received</>

<d>  Map {</>
<g>-   "a" => "b",</>
<g>-   "b" => "a",</>
<r>+   1 => 2,</>
<r>+   2 => 1,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>Set {1, 2}</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
<g>- Expected</>
<r>+ Received</>

<d>  Set {</>
<g>-   3,</>
<g>-   4,</>
<r>+   1,</>
<r>+   2,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with Immutable.js objects"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>, <g>Immutable.Map {"a": {"b": "c"}}</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenNthCalledWith works with three calls"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo1"</>, <g>"bar"</>
Received
->     1:     <d>"foo1"</>, <d>"bar"</>
       2:     <r>"foo"</>, <r>"bar1"</>

Number of calls: <r>3</>`;

module.exports["toHaveBeenNthCalledWith positive throw matcher error for n that is not positive integer"] = `<d>expect(</><r>received</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: 0`;

module.exports["toHaveBeenNthCalledWith positive throw matcher error for n that is not integer"] = `<d>expect(</><r>received</><d>).</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: 0.1`;

module.exports["toHaveBeenNthCalledWith negative throw matcher error for n that is not integer"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: Infinity`;

module.exports["toHaveBeenNthCalledWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>toHaveBeenNthCalledWith<d>(</>n<d>, </><g>...expected</><d>)</>

n: 1
Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toBeCalledWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>

Number of calls: <r>0</>`;

module.exports["toBeCalledWith works with arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <r>"bar1"</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with arguments that don't match in number of arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <d>"bar"</>, <r>"plop"</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with arguments that don't match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>Any<String></>, <g>Any<Number></>
Received: <d>"foo"</>, <r>"bar"</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with arguments that don't match with matchers even when argument is undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>Any<String></>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with arguments that don't match in size even if one is an optional matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>optionalFn<></>
Received: <d>"foo"</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with arguments that match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with arguments that match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Any<String></>, <g>Any<String></>
Received:     <r>0</>, <r>["foo", "bar"]</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with trailing undefined arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with trailing undefined arguments if requested by the match query"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>undefined</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with trailing undefined arguments when explicitly requested as optional by matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>optionalFn<></>
Received:     <r>0</>, <r>["foo", undefined]</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

<g>- Expected</>
<r>+ Received</>

<d>  Map {</>
<g>-   "a" => "b",</>
<g>-   "b" => "a",</>
<r>+   1 => 2,</>
<r>+   2 => 1,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Set {1, 2}</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

<g>- Expected</>
<r>+ Received</>

<d>  Set {</>
<g>-   3,</>
<g>-   4,</>
<r>+   1,</>
<r>+   2,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with Immutable.js objects"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>, <g>Immutable.Map {"a": {"b": "c"}}</>

Number of calls: <r>1</>`;

module.exports["toBeCalledWith works with many arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>
Received
       3:     <d>"foo"</>, <d>"bar"</>

Number of calls: <r>3</>`;

module.exports["toBeCalledWith works with many arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received
       1: <d>"foo"</>, <r>"bar1"</>
       2: <d>"foo"</>, <r>"bar2"</>
       3: <d>"foo"</>, <r>"bar3"</>

Number of calls: <r>3</>`;

module.exports["toBeCalledWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>toBeCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock or spy function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toHaveBeenCalledWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>

Number of calls: <r>0</>`;

module.exports["toHaveBeenCalledWith works with arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <r>"bar1"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with arguments that don't match in number of arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received: <d>"foo"</>, <d>"bar"</>, <r>"plop"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with arguments that don't match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>Any<String></>, <g>Any<Number></>
Received: <d>"foo"</>, <r>"bar"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with arguments that don't match with matchers even when argument is undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>Any<String></>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with arguments that don't match in size even if one is an optional matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>optionalFn<></>
Received: <d>"foo"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with arguments that match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with arguments that match with matchers"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Any<String></>, <g>Any<String></>
Received:     <r>0</>, <r>["foo", "bar"]</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with trailing undefined arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>
Received: <d>"foo"</>, <r>undefined</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with trailing undefined arguments if requested by the match query"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>undefined</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with trailing undefined arguments when explicitly requested as optional by matcher"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>optionalFn<></>
Received:     <r>0</>, <r>["foo", undefined]</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

<g>- Expected</>
<r>+ Received</>

<d>  Map {</>
<g>-   "a" => "b",</>
<g>-   "b" => "a",</>
<r>+   1 => 2,</>
<r>+   2 => 1,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Set {1, 2}</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

<g>- Expected</>
<r>+ Received</>

<d>  Set {</>
<g>-   3,</>
<g>-   4,</>
<r>+   1,</>
<r>+   2,</>
<d>  }</>,

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with Immutable.js objects"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>, <g>Immutable.Map {"a": {"b": "c"}}</>

Number of calls: <r>1</>`;

module.exports["toHaveBeenCalledWith works with many arguments"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>
Received
       3:     <d>"foo"</>, <d>"bar"</>

Number of calls: <r>3</>`;

module.exports["toHaveBeenCalledWith works with many arguments that don't match"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: <g>"foo"</>, <g>"bar"</>
Received
       1: <d>"foo"</>, <r>"bar1"</>
       2: <d>"foo"</>, <r>"bar2"</>
       3: <d>"foo"</>, <r>"bar3"</>

Number of calls: <r>3</>`;

module.exports["toHaveBeenCalledWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>toHaveBeenCalledWith<d>(</><g>...expected</><d>)</>

Expected: not <g>"foo"</>, <g>"bar"</>

Number of calls: <r>1</>`;

module.exports["toReturn .not works only on mock.fn"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toReturn<d>()</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toReturn throw matcher error if received is spy"] = `<d>expect(</><r>received</><d>).</>toReturn<d>()</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function spy]</>`;

module.exports["toReturn passes when returned"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturn<d>()</>

Expected number of returns: <g>0</>
Received number of returns: <r>1</>

1: <r>42</>`;

module.exports["toReturn passes when undefined is returned"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturn<d>()</>

Expected number of returns: <g>0</>
Received number of returns: <r>1</>

1: <r>undefined</>`;

module.exports["toReturn passes when at least one call does not throw"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturn<d>()</>

Expected number of returns: <g>0</>
Received number of returns: <r>2</>

1: <r>42</>
3: <r>42</>

Received number of calls:   <r>3</>`;

module.exports["toReturn .not passes when not returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturn<d>()</>

Expected number of returns: >= <g>1</>
Received number of returns:    <r>0</>`;

module.exports["toReturn .not passes when all calls throw"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturn<d>()</>

Expected number of returns: >= <g>1</>
Received number of returns:    <r>0</>
Received number of calls:      <r>2</>`;

module.exports["toReturn .not passes when a call throws undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturn<d>()</>

Expected number of returns: >= <g>1</>
Received number of returns:    <r>0</>
Received number of calls:      <r>1</>`;

module.exports["toReturn fails with any argument passed"] = `<d>expect(</><r>received</><d>).</>toReturn<d>()</>

<b>Matcher error</>: this matcher must not have an expected argument

Expected has type:  number
Expected has value: <g>555</>`;

module.exports["toReturn .not fails with any argument passed"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toReturn<d>()</>

<b>Matcher error</>: this matcher must not have an expected argument

Expected has type:  number
Expected has value: <g>555</>`;

module.exports["toReturn includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>toReturn<d>()</>

Expected number of returns: <g>0</>
Received number of returns: <r>1</>

1: <r>42</>`;

module.exports["toReturn incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturn<d>()</>

Expected number of returns: >= <g>1</>
Received number of returns:    <r>0</>
Received number of calls:      <r>4</>`;

module.exports["toHaveReturned .not works only on mock.fn"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveReturned<d>()</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toHaveReturned throw matcher error if received is spy"] = `<d>expect(</><r>received</><d>).</>toHaveReturned<d>()</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function spy]</>`;

module.exports["toHaveReturned passes when returned"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturned<d>()</>

Expected number of returns: <g>0</>
Received number of returns: <r>1</>

1: <r>42</>`;

module.exports["toHaveReturned passes when undefined is returned"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturned<d>()</>

Expected number of returns: <g>0</>
Received number of returns: <r>1</>

1: <r>undefined</>`;

module.exports["toHaveReturned passes when at least one call does not throw"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturned<d>()</>

Expected number of returns: <g>0</>
Received number of returns: <r>2</>

1: <r>42</>
3: <r>42</>

Received number of calls:   <r>3</>`;

module.exports["toHaveReturned .not passes when not returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturned<d>()</>

Expected number of returns: >= <g>1</>
Received number of returns:    <r>0</>`;

module.exports["toHaveReturned .not passes when all calls throw"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturned<d>()</>

Expected number of returns: >= <g>1</>
Received number of returns:    <r>0</>
Received number of calls:      <r>2</>`;

module.exports["toHaveReturned .not passes when a call throws undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturned<d>()</>

Expected number of returns: >= <g>1</>
Received number of returns:    <r>0</>
Received number of calls:      <r>1</>`;

module.exports["toHaveReturned fails with any argument passed"] = `<d>expect(</><r>received</><d>).</>toHaveReturned<d>()</>

<b>Matcher error</>: this matcher must not have an expected argument

Expected has type:  number
Expected has value: <g>555</>`;

module.exports["toHaveReturned .not fails with any argument passed"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveReturned<d>()</>

<b>Matcher error</>: this matcher must not have an expected argument

Expected has type:  number
Expected has value: <g>555</>`;

module.exports["toHaveReturned includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>not<d>.</>toHaveReturned<d>()</>

Expected number of returns: <g>0</>
Received number of returns: <r>1</>

1: <r>42</>`;

module.exports["toHaveReturned incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturned<d>()</>

Expected number of returns: >= <g>1</>
Received number of returns:    <r>0</>
Received number of calls:      <r>4</>`;

module.exports["toReturnTimes throw matcher error if received is spy"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function spy]</>`;

module.exports["toReturnTimes only accepts a number argument"] = `<d>expect(</><r>received</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  object
Expected has value: <g>{}</>`;

module.exports["toReturnTimes only accepts a number argument #1"] = `<d>expect(</><r>received</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  array
Expected has value: <g>[]</>`;

module.exports["toReturnTimes only accepts a number argument #2"] = `<d>expect(</><r>received</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  boolean
Expected has value: <g>true</>`;

module.exports["toReturnTimes only accepts a number argument #3"] = `<d>expect(</><r>received</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  string
Expected has value: <g>"a"</>`;

module.exports["toReturnTimes only accepts a number argument #4"] = `<d>expect(</><r>received</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  map
Expected has value: <g>Map {}</>`;

module.exports["toReturnTimes only accepts a number argument #5"] = `<d>expect(</><r>received</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  function
Expected has value: <g>[Function anonymous]</>`;

module.exports["toReturnTimes .not only accepts a number argument"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  object
Expected has value: <g>{}</>`;

module.exports["toReturnTimes .not only accepts a number argument #1"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  array
Expected has value: <g>[]</>`;

module.exports["toReturnTimes .not only accepts a number argument #2"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  boolean
Expected has value: <g>true</>`;

module.exports["toReturnTimes .not only accepts a number argument #3"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  string
Expected has value: <g>"a"</>`;

module.exports["toReturnTimes .not only accepts a number argument #4"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  map
Expected has value: <g>Map {}</>`;

module.exports["toReturnTimes .not only accepts a number argument #5"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  function
Expected has value: <g>[Function anonymous]</>`;

module.exports["toReturnTimes passes if function returned equal to expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

Expected number of returns: not <g>2</>`;

module.exports["toReturnTimes calls that return undefined are counted as returns"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

Expected number of returns: not <g>2</>`;

module.exports["toReturnTimes .not passes if function returned more than expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

Expected number of returns: <g>2</>
Received number of returns: <r>3</>`;

module.exports["toReturnTimes .not passes if function called less than expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

Expected number of returns: <g>2</>
Received number of returns: <r>1</>`;

module.exports["toReturnTimes calls that throw are not counted"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

Expected number of returns: <g>3</>
Received number of returns: <r>2</>
Received number of calls:   <r>3</>`;

module.exports["toReturnTimes calls that throw undefined are not counted"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

Expected number of returns: not <g>2</>

Received number of calls:       <r>3</>`;

module.exports["toReturnTimes includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>toReturnTimes<d>(</><g>expected</><d>)</>

Expected number of returns: <g>1</>
Received number of returns: <r>2</>`;

module.exports["toReturnTimes incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnTimes<d>(</><g>expected</><d>)</>

Expected number of returns: not <g>2</>

Received number of calls:       <r>4</>`;

module.exports["toHaveReturnedTimes throw matcher error if received is spy"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function spy]</>`;

module.exports["toHaveReturnedTimes only accepts a number argument"] = `<d>expect(</><r>received</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  object
Expected has value: <g>{}</>`;

module.exports["toHaveReturnedTimes only accepts a number argument #1"] = `<d>expect(</><r>received</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  array
Expected has value: <g>[]</>`;

module.exports["toHaveReturnedTimes only accepts a number argument #2"] = `<d>expect(</><r>received</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  boolean
Expected has value: <g>true</>`;

module.exports["toHaveReturnedTimes only accepts a number argument #3"] = `<d>expect(</><r>received</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  string
Expected has value: <g>"a"</>`;

module.exports["toHaveReturnedTimes only accepts a number argument #4"] = `<d>expect(</><r>received</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  map
Expected has value: <g>Map {}</>`;

module.exports["toHaveReturnedTimes only accepts a number argument #5"] = `<d>expect(</><r>received</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  function
Expected has value: <g>[Function anonymous]</>`;

module.exports["toHaveReturnedTimes .not only accepts a number argument"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  object
Expected has value: <g>{}</>`;

module.exports["toHaveReturnedTimes .not only accepts a number argument #1"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  array
Expected has value: <g>[]</>`;

module.exports["toHaveReturnedTimes .not only accepts a number argument #2"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  boolean
Expected has value: <g>true</>`;

module.exports["toHaveReturnedTimes .not only accepts a number argument #3"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  string
Expected has value: <g>"a"</>`;

module.exports["toHaveReturnedTimes .not only accepts a number argument #4"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  map
Expected has value: <g>Map {}</>`;

module.exports["toHaveReturnedTimes .not only accepts a number argument #5"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <g>expected</> value must be a non-negative integer

Expected has type:  function
Expected has value: <g>[Function anonymous]</>`;

module.exports["toHaveReturnedTimes passes if function returned equal to expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

Expected number of returns: not <g>2</>`;

module.exports["toHaveReturnedTimes calls that return undefined are counted as returns"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

Expected number of returns: not <g>2</>`;

module.exports["toHaveReturnedTimes .not passes if function returned more than expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

Expected number of returns: <g>2</>
Received number of returns: <r>3</>`;

module.exports["toHaveReturnedTimes .not passes if function called less than expected times"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

Expected number of returns: <g>2</>
Received number of returns: <r>1</>`;

module.exports["toHaveReturnedTimes calls that throw are not counted"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

Expected number of returns: <g>3</>
Received number of returns: <r>2</>
Received number of calls:   <r>3</>`;

module.exports["toHaveReturnedTimes calls that throw undefined are not counted"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

Expected number of returns: not <g>2</>

Received number of calls:       <r>3</>`;

module.exports["toHaveReturnedTimes includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

Expected number of returns: <g>1</>
Received number of returns: <r>2</>`;

module.exports["toHaveReturnedTimes incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedTimes<d>(</><g>expected</><d>)</>

Expected number of returns: not <g>2</>

Received number of calls:       <r>4</>`;

module.exports["lastReturnedWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["lastReturnedWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["lastReturnedWith works with argument that does not match"] = `<d>expect(</><r>jest.fn()</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"bar"</>
Received: <r>"foo"</>

Number of returns: <r>1</>`;

module.exports["lastReturnedWith works with argument that does match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>"foo"</>

Number of returns: <r>1</>`;

module.exports["lastReturnedWith works with undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>undefined</>

Number of returns: <r>1</>`;

module.exports["lastReturnedWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["lastReturnedWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>Map {"a" => "b", "b" => "a"}</>
Received: <r>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["lastReturnedWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["lastReturnedWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>Set {3, 4}</>
Received: <r>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["lastReturnedWith works with Immutable.js objects directly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["lastReturnedWith works with Immutable.js objects indirectly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["lastReturnedWith a call that throws is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["lastReturnedWith a call that throws undefined is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["lastReturnedWith returnedWith works with more calls than the limit"] = `<d>expect(</><r>jest.fn()</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"bar"</>
Received
       5: <r>"foo5"</>
->     6: <r>"foo6"</>

Number of returns: <r>6</>`;

module.exports["lastReturnedWith returnedWith incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received
       3: function call has not returned yet
->     4: function call has not returned yet

Number of returns: <r>0</>
Number of calls:   <r>4</>`;

module.exports["lastReturnedWith lastReturnedWith works with three calls"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>"foo3"</>
Received
       2:     <r>"foo2"</>
->     3:     <d>"foo3"</>

Number of returns: <r>3</>`;

module.exports["lastReturnedWith lastReturnedWith incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>0</>
Received
       3: function call has not returned yet
->     4: function call has not returned yet

Number of returns: <r>0</>
Number of calls:   <r>4</>`;

module.exports["lastReturnedWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>lastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["toHaveLastReturnedWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toHaveLastReturnedWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["toHaveLastReturnedWith works with argument that does not match"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"bar"</>
Received: <r>"foo"</>

Number of returns: <r>1</>`;

module.exports["toHaveLastReturnedWith works with argument that does match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>"foo"</>

Number of returns: <r>1</>`;

module.exports["toHaveLastReturnedWith works with undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>undefined</>

Number of returns: <r>1</>`;

module.exports["toHaveLastReturnedWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["toHaveLastReturnedWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>Map {"a" => "b", "b" => "a"}</>
Received: <r>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["toHaveLastReturnedWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["toHaveLastReturnedWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>Set {3, 4}</>
Received: <r>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["toHaveLastReturnedWith works with Immutable.js objects directly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["toHaveLastReturnedWith works with Immutable.js objects indirectly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["toHaveLastReturnedWith a call that throws is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["toHaveLastReturnedWith a call that throws undefined is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["toHaveLastReturnedWith returnedWith works with more calls than the limit"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"bar"</>
Received
       5: <r>"foo5"</>
->     6: <r>"foo6"</>

Number of returns: <r>6</>`;

module.exports["toHaveLastReturnedWith returnedWith incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received
       3: function call has not returned yet
->     4: function call has not returned yet

Number of returns: <r>0</>
Number of calls:   <r>4</>`;

module.exports["toHaveLastReturnedWith lastReturnedWith works with three calls"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>"foo3"</>
Received
       2:     <r>"foo2"</>
->     3:     <d>"foo3"</>

Number of returns: <r>3</>`;

module.exports["toHaveLastReturnedWith lastReturnedWith incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>0</>
Received
       3: function call has not returned yet
->     4: function call has not returned yet

Number of returns: <r>0</>
Number of calls:   <r>4</>`;

module.exports["toHaveLastReturnedWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>toHaveLastReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["nthReturnedWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["nthReturnedWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["nthReturnedWith works with argument that does not match"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>"bar"</>
Received: <r>"foo"</>

Number of returns: <r>1</>`;

module.exports["nthReturnedWith works with argument that does match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>"foo"</>

Number of returns: <r>1</>`;

module.exports["nthReturnedWith works with undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>undefined</>

Number of returns: <r>1</>`;

module.exports["nthReturnedWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["nthReturnedWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>Map {"a" => "b", "b" => "a"}</>
Received: <r>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["nthReturnedWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["nthReturnedWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>Set {3, 4}</>
Received: <r>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["nthReturnedWith works with Immutable.js objects directly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["nthReturnedWith works with Immutable.js objects indirectly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["nthReturnedWith a call that throws is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["nthReturnedWith a call that throws undefined is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["nthReturnedWith nthReturnedWith works with three calls"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>"foo1"</>
Received
->     1:     <d>"foo1"</>
       2:     <r>"foo2"</>

Number of returns: <r>3</>`;

module.exports["nthReturnedWith nthReturnedWith should replace 1st, 2nd, 3rd with first, second, third"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>"bar1"</>
Received
->     1: <r>"foo1"</>
       2: <r>"foo2"</>

Number of returns: <r>3</>`;

module.exports["nthReturnedWith nthReturnedWith should replace 1st, 2nd, 3rd with first, second, third #1"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>"foo1"</>
Received
->     1:     <d>"foo1"</>
       2:     <r>"foo2"</>

Number of returns: <r>3</>`;

module.exports["nthReturnedWith nthReturnedWith positive throw matcher error for n that is not positive integer"] = `<d>expect(</><r>received</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: 0`;

module.exports["nthReturnedWith nthReturnedWith should reject nth value greater than number of calls"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 4
Expected: <g>"foo"</>
Received
       3: <d>"foo"</>

Number of returns: <r>3</>`;

module.exports["nthReturnedWith nthReturnedWith positive throw matcher error for n that is not integer"] = `<d>expect(</><r>received</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: 0.1`;

module.exports["nthReturnedWith nthReturnedWith negative throw matcher error for n that is not number"] = `<d>expect(</><r>received</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has value: undefined`;

module.exports["nthReturnedWith nthReturnedWith incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>6</>
Received
->     1: function call has not returned yet
       2: function call has not returned yet

Number of returns: <r>2</>
Number of calls:   <r>4</>`;

module.exports["nthReturnedWith nthReturnedWith incomplete recursive calls are handled properly #1"] = `<d>expect(</><r>jest.fn()</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 2
Expected: <g>3</>
Received
       1: function call has not returned yet
->     2: function call has not returned yet
       3: <r>1</>

Number of returns: <r>2</>
Number of calls:   <r>4</>`;

module.exports["nthReturnedWith nthReturnedWith incomplete recursive calls are handled properly #2"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 3
Expected: not <g>1</>
Received
       2:     function call has not returned yet
->     3:     <d>1</>
       4:     <r>0</>

Number of returns: <r>2</>
Number of calls:   <r>4</>`;

module.exports["nthReturnedWith nthReturnedWith incomplete recursive calls are handled properly #3"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 4
Expected: not <g>0</>
Received
       3:     <r>1</>
->     4:     <d>0</>

Number of returns: <r>2</>
Number of calls:   <r>4</>`;

module.exports["nthReturnedWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>nthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["toHaveNthReturnedWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toHaveNthReturnedWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["toHaveNthReturnedWith works with argument that does not match"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>"bar"</>
Received: <r>"foo"</>

Number of returns: <r>1</>`;

module.exports["toHaveNthReturnedWith works with argument that does match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>"foo"</>

Number of returns: <r>1</>`;

module.exports["toHaveNthReturnedWith works with undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>undefined</>

Number of returns: <r>1</>`;

module.exports["toHaveNthReturnedWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["toHaveNthReturnedWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>Map {"a" => "b", "b" => "a"}</>
Received: <r>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["toHaveNthReturnedWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["toHaveNthReturnedWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>Set {3, 4}</>
Received: <r>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["toHaveNthReturnedWith works with Immutable.js objects directly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["toHaveNthReturnedWith works with Immutable.js objects indirectly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["toHaveNthReturnedWith a call that throws is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["toHaveNthReturnedWith a call that throws undefined is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["toHaveNthReturnedWith nthReturnedWith works with three calls"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>"foo1"</>
Received
->     1:     <d>"foo1"</>
       2:     <r>"foo2"</>

Number of returns: <r>3</>`;

module.exports["toHaveNthReturnedWith nthReturnedWith should replace 1st, 2nd, 3rd with first, second, third"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>"bar1"</>
Received
->     1: <r>"foo1"</>
       2: <r>"foo2"</>

Number of returns: <r>3</>`;

module.exports["toHaveNthReturnedWith nthReturnedWith should replace 1st, 2nd, 3rd with first, second, third #1"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: not <g>"foo1"</>
Received
->     1:     <d>"foo1"</>
       2:     <r>"foo2"</>

Number of returns: <r>3</>`;

module.exports["toHaveNthReturnedWith nthReturnedWith positive throw matcher error for n that is not positive integer"] = `<d>expect(</><r>received</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: 0`;

module.exports["toHaveNthReturnedWith nthReturnedWith should reject nth value greater than number of calls"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 4
Expected: <g>"foo"</>
Received
       3: <d>"foo"</>

Number of returns: <r>3</>`;

module.exports["toHaveNthReturnedWith nthReturnedWith positive throw matcher error for n that is not integer"] = `<d>expect(</><r>received</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has type:  number
n has value: 0.1`;

module.exports["toHaveNthReturnedWith nthReturnedWith negative throw matcher error for n that is not number"] = `<d>expect(</><r>received</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

<b>Matcher error</>: n must be a positive integer

n has value: undefined`;

module.exports["toHaveNthReturnedWith nthReturnedWith incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>6</>
Received
->     1: function call has not returned yet
       2: function call has not returned yet

Number of returns: <r>2</>
Number of calls:   <r>4</>`;

module.exports["toHaveNthReturnedWith nthReturnedWith incomplete recursive calls are handled properly #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 2
Expected: <g>3</>
Received
       1: function call has not returned yet
->     2: function call has not returned yet
       3: <r>1</>

Number of returns: <r>2</>
Number of calls:   <r>4</>`;

module.exports["toHaveNthReturnedWith nthReturnedWith incomplete recursive calls are handled properly #2"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 3
Expected: not <g>1</>
Received
       2:     function call has not returned yet
->     3:     <d>1</>
       4:     <r>0</>

Number of returns: <r>2</>
Number of calls:   <r>4</>`;

module.exports["toHaveNthReturnedWith nthReturnedWith incomplete recursive calls are handled properly #3"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 4
Expected: not <g>0</>
Received
       3:     <r>1</>
->     4:     <d>0</>

Number of returns: <r>2</>
Number of calls:   <r>4</>`;

module.exports["toHaveNthReturnedWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>toHaveNthReturnedWith<d>(</>n<d>, </><g>expected</><d>)</>

n: 1
Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["toReturnWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toReturnWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["toReturnWith works with argument that does not match"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: <g>"bar"</>
Received: <r>"foo"</>

Number of returns: <r>1</>`;

module.exports["toReturnWith works with argument that does match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: not <g>"foo"</>

Number of returns: <r>1</>`;

module.exports["toReturnWith works with undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: not <g>undefined</>

Number of returns: <r>1</>`;

module.exports["toReturnWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["toReturnWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: <g>Map {"a" => "b", "b" => "a"}</>
Received: <r>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["toReturnWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: not <g>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["toReturnWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: <g>Set {3, 4}</>
Received: <r>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["toReturnWith works with Immutable.js objects directly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["toReturnWith works with Immutable.js objects indirectly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["toReturnWith a call that throws is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["toReturnWith a call that throws undefined is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["toReturnWith returnedWith works with more calls than the limit"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: <g>"bar"</>
Received
       1: <r>"foo1"</>
       2: <r>"foo2"</>
       3: <r>"foo3"</>

Number of returns: <r>6</>`;

module.exports["toReturnWith returnedWith incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received
       1: function call has not returned yet
       2: function call has not returned yet
       3: function call has not returned yet

Number of returns: <r>0</>
Number of calls:   <r>4</>`;

module.exports["toReturnWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>toReturnWith<d>(</><g>expected</><d>)</>

Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["toHaveReturnedWith works only on spies or mock.fn"] = `<d>expect(</><r>received</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

<b>Matcher error</>: <r>received</> value must be a mock function

Received has type:  function
Received has value: <r>[Function fn]</>`;

module.exports["toHaveReturnedWith works when not called"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"foo"</>

Number of returns: <r>0</>`;

module.exports["toHaveReturnedWith works with argument that does not match"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"bar"</>
Received: <r>"foo"</>

Number of returns: <r>1</>`;

module.exports["toHaveReturnedWith works with argument that does match"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>"foo"</>

Number of returns: <r>1</>`;

module.exports["toHaveReturnedWith works with undefined"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>undefined</>

Number of returns: <r>1</>`;

module.exports["toHaveReturnedWith works with Map"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["toHaveReturnedWith works with Map #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>Map {"a" => "b", "b" => "a"}</>
Received: <r>Map {1 => 2, 2 => 1}</>

Number of returns: <r>1</>`;

module.exports["toHaveReturnedWith works with Set"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["toHaveReturnedWith works with Set #1"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>Set {3, 4}</>
Received: <r>Set {1, 2}</>

Number of returns: <r>1</>`;

module.exports["toHaveReturnedWith works with Immutable.js objects directly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["toHaveReturnedWith works with Immutable.js objects indirectly created"] = `<d>expect(</><r>jest.fn()</><d>).</>not<d>.</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: not <g>Immutable.Map {"a": {"b": "c"}}</>

Number of returns: <r>1</>`;

module.exports["toHaveReturnedWith a call that throws is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["toHaveReturnedWith a call that throws undefined is not considered to have returned"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received: function call threw an error

Number of returns: <r>0</>
Number of calls:   <r>1</>`;

module.exports["toHaveReturnedWith returnedWith works with more calls than the limit"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"bar"</>
Received
       1: <r>"foo1"</>
       2: <r>"foo2"</>
       3: <r>"foo3"</>

Number of returns: <r>6</>`;

module.exports["toHaveReturnedWith returnedWith incomplete recursive calls are handled properly"] = `<d>expect(</><r>jest.fn()</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>undefined</>
Received
       1: function call has not returned yet
       2: function call has not returned yet
       3: function call has not returned yet

Number of returns: <r>0</>
Number of calls:   <r>4</>`;

module.exports["toHaveReturnedWith includes the custom mock name in the error message"] = `<d>expect(</><r>named-mock</><d>).</>toHaveReturnedWith<d>(</><g>expected</><d>)</>

Expected: <g>"foo"</>

Number of returns: <r>0</>`;

