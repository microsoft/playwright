class Foo {
  bar(options: {x: number, y: number, maybe?: number, nullable: string|null, object?: {one: number, two?: number}}) {

  }

  async goBack() : Promise<Response | null> {
    return null;
  }

  response(): Response | null {
    return null;
  }

  baz(): {abc: number, def?: number, ghi: string} | null {
    return null;
  }
}

export {Foo};