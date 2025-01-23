# class: MockingProxyFactory
* since: v1.51

This class is used for creating [MockingProxy] instances which in turn can be used to intercept network traffic from your application server. An instance
of this class can be obtained via [`property: Playwright.mockingProxy`]. For more information
see [MockingProxy].

## async method: MockingProxyFactory.newProxy
* since: v1.51
- returns: <[MockingProxy]>

Creates a new instance of [MockingProxy].

### param: MockingProxyFactory.newProxy.port
* since: v1.51
- `port` ?<[int]>

Port to listen on.
