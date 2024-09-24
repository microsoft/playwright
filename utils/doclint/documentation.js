/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

const md = require('../markdown');

/** @typedef {import('../markdown').MarkdownNode} MarkdownNode */

/**
 * @typedef {{
  *   name: string,
  *   args: ParsedType | null,
  *   retType: ParsedType | null,
  *   template: ParsedType | null,
  *   union: ParsedType | null,
  *   unionName?: string,
  *   next: ParsedType | null,
  * }} ParsedType
  */

/**
 * @typedef {{
 *   only?: string[],
 *   aliases?: Object<string, string>,
 *   types?: Object<string, Type>,
 *   overrides?: Object<string, Member>,
 * }} Langs
 */

/**
 * @typedef {function({
 *   clazz?: Class,
 *   member?: Member,
 *   param?: string,
 *   option?: string,
 *   href?: string,
 * }): string|undefined} Renderer
 */

/**
 * @typedef {{
 *   langs: Langs,
 *   since: string,
 *   deprecated?: string | undefined,
 *   discouraged?: string | undefined,
 * }} Metainfo
 */

/**
 * @typedef {{
 *   csharpOptionOverloadsShortNotation?: boolean,
 * }} LanguageOptions
 */

/** @typedef {{
 *    value: string, groupId: string, spec: MarkdownNode
 * }} CodeGroup */

/** @typedef {function(CodeGroup[]): MarkdownNode[]} CodeGroupTransformer */

class Documentation {
  /**
   * @param {!Array<!Class>} classesArray
   */
  constructor(classesArray) {
    this.classesArray = classesArray;
    /** @type {!Map<string, !Class>} */
    this.classes = new Map();
    this.index();
  }

  /**
   * @param {!Documentation} documentation
   * @return {!Documentation}
   */
  mergeWith(documentation) {
    return new Documentation([...this.classesArray, ...documentation.classesArray].map(cls => cls.clone()));
  }

  /**
   * @param {string[]} errors
   */
  copyDocsFromSuperclasses(errors) {
    for (const [name, clazz] of this.classes.entries()) {
      clazz.sortMembers();

      if (!clazz.extends || ['Error', 'Exception', 'RuntimeException'].includes(clazz.extends))
        continue;
      const superClass = this.classes.get(clazz.extends);
      if (!superClass) {
        errors.push(`Undefined superclass: ${superClass} in ${name}`);
        continue;
      }
      for (const memberName of clazz.members.keys()) {
        if (superClass.members.has(memberName))
          errors.push(`Member documentation overrides base: ${name}.${memberName} over ${clazz.extends}.${memberName}`);
      }

      clazz.membersArray = [...clazz.membersArray, ...superClass.membersArray.map(c => c.clone())];
      clazz.index();
    }
  }

  /**
   * @param {string} lang
   * @param {LanguageOptions=} options
   */
  filterForLanguage(lang, options = {}) {
    const classesArray = [];
    for (const clazz of this.classesArray) {
      if (clazz.langs.only && !clazz.langs.only.includes(lang))
        continue;
      clazz.filterForLanguage(lang, options);
      classesArray.push(clazz);
    }
    this.classesArray = classesArray;
    this.index();
  }

  index() {
    for (const cls of this.classesArray) {
      this.classes.set(cls.name, cls);
      cls.index();
    }
  }

  /**
   * @param {Renderer} linkRenderer
   */
  setLinkRenderer(linkRenderer) {
    // @type {Map<string, Class>}
    const classesMap = new Map();
    const membersMap = new Map();
    for (const clazz of this.classesArray) {
      classesMap.set(clazz.name, clazz);
      for (const member of clazz.membersArray)
        membersMap.set(`${member.kind}: ${clazz.name}.${member.name}`, member);
    }
    /**
     * @param {Class|Member|undefined} classOrMember
     * @param {string} text
     */
    this._patchLinksInText = (classOrMember, text) => patchLinksInText(classOrMember, text, classesMap, membersMap, linkRenderer);

    for (const clazz of this.classesArray)
      clazz.visit(item => item.spec && this.renderLinksInNodes(item.spec, item));
  }

  /**
   * @param {MarkdownNode[]} nodes
   * @param {Class|Member=} classOrMember
   */
  renderLinksInNodes(nodes, classOrMember) {
    if (classOrMember instanceof Member) {
      classOrMember.discouraged = classOrMember.discouraged ? this.renderLinksInText(classOrMember.discouraged, classOrMember) : undefined;
      classOrMember.deprecated = classOrMember.deprecated ? this.renderLinksInText(classOrMember.deprecated, classOrMember) : undefined;
    }
    md.visitAll(nodes, node => {
      if (!node.text)
        return;
      node.text = this.renderLinksInText(node.text, classOrMember);
    });
  }

  /**
   * @param {string} text
   * @param {Class|Member=} classOrMember
   */
  renderLinksInText(text, classOrMember) {
    return this._patchLinksInText?.(classOrMember, text);
  }

  /**
   * @param {string} lang
   * @param {CodeGroupTransformer} transformer
   */
  setCodeGroupsTransformer(lang, transformer) {
    this._codeGroupsTransformer = { lang, transformer };
  }

  generateSourceCodeComments() {
    for (const clazz of this.classesArray) {
      clazz.visit(item => {
        let spec = item.spec;
        if (spec && this._codeGroupsTransformer)
          spec = processCodeGroups(spec, this._codeGroupsTransformer.lang, this._codeGroupsTransformer.transformer);
        item.comment = generateSourceCodeComment(spec);
      });
    }
  }

  clone() {
    return new Documentation(this.classesArray.map(cls => cls.clone()));
  }
}

class Class {
  /**
   * @param {Metainfo} metainfo
   * @param {string} name
   * @param {!Array<!Member>} membersArray
   * @param {?string=} extendsName
   * @param {MarkdownNode[]=} spec
   */
  constructor(metainfo, name, membersArray, extendsName = null, spec = undefined) {
    this.langs = metainfo.langs;
    this.since = metainfo.since;
    this.deprecated = metainfo.deprecated;
    this.discouraged = metainfo.discouraged;
    this.name = name;
    this.membersArray = membersArray;
    this.spec = spec;
    this.extends = extendsName;
    this.comment = '';
    this.index();
    const match = /** @type {string[]} */(name.match(/(API|JS|CDP|[A-Z])(.*)/));
    this.varName = match[1].toLowerCase() + match[2];
    /** @type {!Map<string, !Member>} */
    this.members = new Map();
    /** @type {!Map<string, !Member>} */
    this.properties = new Map();
    /** @type {!Array<!Member>} */
    this.propertiesArray = [];
    /** @type {!Map<string, !Member>} */
    this.methods = new Map();
    /** @type {!Array<!Member>} */
    this.methodsArray = [];
    /** @type {!Map<string, !Member>} */
    this.events = new Map();
    /** @type {!Array<!Member>} */
    this.eventsArray = [];
  }

  index() {
    this.members = new Map();
    this.properties = new Map();
    this.propertiesArray = [];
    this.methods = new Map();
    this.methodsArray = [];
    this.events = new Map();
    this.eventsArray = [];

    for (const member of this.membersArray) {
      this.members.set(member.name, member);
      if (member.kind === 'method') {
        this.methods.set(member.name, member);
        this.methodsArray.push(member);
      } else if (member.kind === 'property') {
        this.properties.set(member.name, member);
        this.propertiesArray.push(member);
      } else if (member.kind === 'event') {
        this.events.set(member.name, member);
        this.eventsArray.push(member);
      }
      member.clazz = this;
      member.index();
    }
  }

  clone() {
    const cls = new Class({ langs: this.langs, since: this.since, deprecated: this.deprecated, discouraged: this.discouraged }, this.name, this.membersArray.map(m => m.clone()), this.extends, this.spec);
    cls.comment = this.comment;
    return cls;
  }

  /**
   * @param {string} lang
   * @param {LanguageOptions=} options
   */
  filterForLanguage(lang, options = {}) {
    const membersArray = [];
    for (const member of this.membersArray) {
      if (member.langs.only && !member.langs.only.includes(lang))
        continue;
      member.filterForLanguage(lang, options);
      membersArray.push(member);
    }
    this.membersArray = membersArray;
  }

  sortMembers() {
    /**
     * @param {Member} member
     */
    function sortKey(member) {
      return { 'event': 'a', 'method': 'b', 'property': 'c' }[member.kind] + member.alias;
    }

    this.membersArray.sort((m1, m2) => {
      return sortKey(m1).localeCompare(sortKey(m2), 'en', { sensitivity: 'base' });
    });

    // Ideally, we would automatically make options the last argument.
    // However, that breaks Java, since options are not always last in Java, for example
    // in page.waitForFileChooser(options, callback).
    // So, the order must be carefully setup in the md file!
  }

  /**
   * @param {function(Member|Class): void} visitor
   */
  visit(visitor) {
    visitor(this);
    for (const p of this.propertiesArray)
      p.visit(visitor);
    for (const m of this.methodsArray)
      m.visit(visitor);
    for (const e of this.eventsArray)
      e.visit(visitor);
  }
}

class Member {
  /**
   * @param {string} kind
   * @param {Metainfo} metainfo
   * @param {string} name
   * @param {?Type} type
   * @param {!Array<!Member>} argsArray
   * @param {MarkdownNode[]=} spec
   * @param {boolean=} required
   */
  constructor(kind, metainfo, name, type, argsArray, spec = undefined, required = true) {
    this.kind = kind;
    this.langs = metainfo.langs;
    this.since = metainfo.since;
    this.deprecated = metainfo.deprecated;
    this.discouraged = metainfo.discouraged;
    this.name = name;
    this.type = type;
    this.spec = spec;
    this.argsArray = argsArray;
    this.required = required;
    this.comment = '';
    /** @type {!Map<string, !Member>} */
    this.args = new Map();
    this.index();
    /** @type {!Class | null} */
    this.clazz = null;
    /** @type {Member=} */
    this.enclosingMethod = undefined;
    /** @type {Member=} */
    this.parent = undefined;
    this.async = false;
    this.alias = name;
    this.overloadIndex = 0;
    if (name.includes('#')) {
      const match = /** @type {string[]} */(name.match(/(.*)#(.*)/));
      this.alias = match[1];
      this.overloadIndex = (+match[2]) - 1;
    }
  }

  index() {
    this.args = new Map();
    if (this.kind === 'method')
      this.enclosingMethod = this;
    const indexArg = (/** @type {Member} */ arg) => {
      arg.type?.deepProperties().forEach(p => {
        p.enclosingMethod = this;
        p.parent = arg;
        indexArg(p);
      });
    }
    for (const arg of this.argsArray) {
      this.args.set(arg.name, arg);
      arg.enclosingMethod = this;
      if (arg.name === 'options')
        arg.type?.properties?.sort((p1, p2) => p1.name.localeCompare(p2.name));
      indexArg(arg);
    }
  }

  /**
   * @param {string} lang
   * @param {LanguageOptions=} options
   */
  filterForLanguage(lang, options = {}) {
    if (!this.type)
      return;
    if (this.langs.aliases && this.langs.aliases[lang])
      this.alias = this.langs.aliases[lang];
    if (this.langs.types && this.langs.types[lang])
      this.type = this.langs.types[lang];
    this.type.filterForLanguage(lang, options);
    const argsArray = [];
    for (const arg of this.argsArray) {
      if (arg.langs.only && !arg.langs.only.includes(lang))
        continue;
      const overriddenArg = (arg.langs.overrides && arg.langs.overrides[lang]) || arg;
      overriddenArg.filterForLanguage(lang, options);
      if (overriddenArg.name === 'options' && !overriddenArg.type?.properties?.length)
        continue;
      overriddenArg.type?.filterForLanguage(lang, options);
      argsArray.push(overriddenArg);
    }
    this.argsArray = argsArray;

    const optionsArg = this.argsArray.find(arg => arg.name === 'options');
    if (lang === 'csharp' && optionsArg) {
      try {
        patchCSharpOptionOverloads(optionsArg, options);
      } catch (e) {
        throw new Error(`Error processing csharp options in ${this.clazz?.name}.${this.name}: ` + e.message);
      }
    }
  }

  clone() {
    const result = new Member(this.kind, { langs: this.langs, since: this.since, deprecated: this.deprecated, discouraged: this.discouraged }, this.name, this.type?.clone(), this.argsArray.map(arg => arg.clone()), this.spec, this.required);
    result.alias = this.alias;
    result.async = this.async;
    return result;
  }

  /**
   * @param {Metainfo} metainfo
   * @param {string} name
   * @param {!Array<!Member>} argsArray
   * @param {?Type} returnType
   * @param {MarkdownNode[]=} spec
   * @return {!Member}
   */
  static createMethod(metainfo, name, argsArray, returnType, spec) {
    return new Member('method', metainfo, name, returnType, argsArray, spec);
  }

  /**
   * @param {Metainfo} metainfo
   * @param {!string} name
   * @param {!Type} type
   * @param {!MarkdownNode[]=} spec
   * @param {boolean=} required
   * @return {!Member}
   */
  static createProperty(metainfo, name, type, spec, required) {
    return new Member('property', metainfo, name, type, [], spec, required);
  }

  /**
   * @param {Metainfo} metainfo
   * @param {string} name
   * @param {?Type=} type
   * @param {MarkdownNode[]=} spec
   * @return {!Member}
   */
  static createEvent(metainfo, name, type = null, spec) {
    return new Member('event', metainfo, name, type, [], spec);
  }

  /**
   * @param {function(Member|Class): void} visitor
   */
  visit(visitor) {
    visitor(this);
    if (this.type)
      this.type.visit(visitor);
    for (const arg of this.argsArray)
      arg.visit(visitor);
    for (const lang in this.langs.overrides || {})
      this.langs.overrides?.[lang].visit(visitor);
  }
}

class Type {
  /**
   * @param {string} expression
   * @param {!Array<!Member>=} properties
   * @return {Type}
   */
  static parse(expression, properties = []) {
    expression = expression.replace(/\\\(/g, '(').replace(/\\\)/g, ')');
    const type = Type.fromParsedType(parseTypeExpression(expression));
    type.expression = expression;
    if (type.name === 'number')
      throw new Error('Number types should be either int or float, not number in: ' + expression);
    if (!properties.length)
      return type;
    const types = [];
    type._collectAllTypes(types);
    let success = false;
    for (const t of types) {
      if (t.name === 'Object') {
        t.properties = properties;
        success = true;
      }
    }
    if (!success)
      throw new Error('Nested properties given, but there are no objects in type expression: ' + expression);
    return type;
  }

  /**
   * @param {ParsedType} parsedType
   * @return {Type}
   */
  static fromParsedType(parsedType, inUnion = false) {
    if (!inUnion && !parsedType.unionName && isStringUnion(parsedType))
      throw new Error('Enum must have a name:\n' + JSON.stringify(parsedType, null, 2));


    if (!inUnion && (parsedType.union || parsedType.unionName)) {
      const type = new Type(parsedType.unionName || '');
      type.union = [];
      for (let /** @type {ParsedType | null} */ t = parsedType; t; t = t.union) {
        const nestedUnion = !!t.unionName && t !== parsedType;
        type.union.push(Type.fromParsedType(t, !nestedUnion));
        if (nestedUnion)
          break;
      }
      return type;
    }

    if (parsedType.args || parsedType.retType) {
      const type = new Type('function');
      type.args = [];
      for (let t = parsedType.args; t; t = t.next)
        type.args.push(Type.fromParsedType(t));
      type.returnType = parsedType.retType ? Type.fromParsedType(parsedType.retType) : undefined;
      return type;
    }

    if (parsedType.template) {
      const type = new Type(parsedType.name);
      type.templates = [];
      for (let /** @type {ParsedType | null} */ t = parsedType.template; t; t = t.next)
        type.templates.push(Type.fromParsedType(t));
      return type;
    }
    return new Type(parsedType.name);
  }

  /**
   * @param {string} name
   * @param {!Array<!Member>=} properties
   */
  constructor(name, properties) {
    this.name = name.replace(/^\[/, '').replace(/\]$/, '');
    /** @type {Member[] | undefined} */
    this.properties = this.name === 'Object' ? properties : undefined;
    /** @type {Type[] | undefined} */
    this.union = undefined;
    /** @type {Type[] | undefined} */
    this.args = undefined;
    /** @type {Type | undefined} */
    this.returnType = undefined;
    /** @type {Type[] | undefined} */
    this.templates = undefined;
    /** @type {string | undefined} */
    this.expression = undefined;
  }

  visit(visitor) {
    const types = [];
    this._collectAllTypes(types);
    for (const type of types) {
      for (const p of type.properties || [])
        p.visit(visitor);
    }
  }

  clone() {
    const type = new Type(this.name, this.properties ? this.properties.map(prop => prop.clone()) : undefined);
    if (this.union)
      type.union = this.union.map(type => type.clone());
    if (this.args)
      type.args = this.args.map(type => type.clone());
    if (this.returnType)
      type.returnType = this.returnType.clone();
    if (this.templates)
      type.templates = this.templates.map(type => type.clone());
    type.expression = this.expression;
    return type;
  }

  /**
   * @returns {Member[]}
   */
  deepProperties() {
    const types = [];
    this._collectAllTypes(types);
    for (const type of types) {
      if (type.properties && type.properties.length)
        return type.properties;
    }
    return [];
  }

  /**
   * @param {string} lang
   * @param {LanguageOptions=} options
   */
  filterForLanguage(lang, options = {}) {
    if (!this.properties)
      return;
    const properties = [];
    for (const prop of this.properties) {
      if (prop.langs.only && !prop.langs.only.includes(lang))
        continue;
      prop.filterForLanguage(lang, options);
      properties.push(prop);
    }
    this.properties = properties;
  }

  /**
   * @param {Type[]} result
   */
  _collectAllTypes(result) {
    result.push(this);
    for (const t of this.union || [])
      t._collectAllTypes(result);
    for (const t of this.args || [])
      t._collectAllTypes(result);
    for (const t of this.templates || [])
      t._collectAllTypes(result);
    if (this.returnType)
      this.returnType._collectAllTypes(result);
  }
}

/**
 * @param {ParsedType | null} type
 * @returns {boolean}
 */
function isStringUnion(type) {
  while (type) {
    if (!type.name.startsWith('"') || !type.name.endsWith('"'))
      return false;
    type = type.union;
  }
  return true;
}

/**
 * @param {string} type
 * @returns {ParsedType}
 */
function parseTypeExpression(type) {
  type = type.trim();
  let name = type;
  let next = null;
  let template = null;
  let args = null;
  let retType = null;
  let firstTypeLength = type.length;

  for (let i = 0; i < type.length; i++) {
    if (type[i] === '<') {
      name = type.substring(0, i);
      const matching = matchingBracket(type.substring(i), '<', '>');
      template = parseTypeExpression(type.substring(i + 1, i + matching - 1));
      firstTypeLength = i + matching;
      break;
    }
    if (type[i] === '(') {
      name = type.substring(0, i);
      const matching = matchingBracket(type.substring(i), '(', ')');
      const argsString = type.substring(i + 1, i + matching - 1);
      args = argsString ? parseTypeExpression(argsString) : null;
      i = i + matching;
      if (type[i] === ':') {
        retType = parseTypeExpression(type.substring(i + 1));
        next = retType.next;
        retType.next = null;
        break;
      }
    }
    if (type[i] === '|' || type[i] === ',') {
      name = type.substring(0, i);
      firstTypeLength = i;
      break;
    }
  }
  let union = null;
  if (type[firstTypeLength] === '|')
    union = parseTypeExpression(type.substring(firstTypeLength + 1));
  else if (type[firstTypeLength] === ',')
    next = parseTypeExpression(type.substring(firstTypeLength + 1));

  if (template && !template.unionName && isStringUnion(template)) {
    template.unionName = name;
    return template;
  }

  return {
    name,
    args,
    retType,
    template,
    union,
    next
  };
}

/**
 * @param {string} str
 * @param {any} open
 * @param {any} close
 */
function matchingBracket(str, open, close) {
  let count = 1;
  let i = 1;
  for (; i < str.length && count; i++) {
    if (str[i] === open)
      count++;
    else if (str[i] === close)
      count--;
  }
  return i;
}

/**
 * @param {Class|Member|undefined} classOrMember
 * @param {string} text
 * @param {Map<string, Class>} classesMap
 * @param {Map<string, Member>} membersMap
 * @param {Renderer} linkRenderer
 */
function patchLinksInText(classOrMember, text, classesMap, membersMap, linkRenderer) {
  text = text.replace(/\[`(\w+): ([^\]]+)`\](?:\(([^)]*?)\))?/g, (match, p1, p2, href) => {
    if (['event', 'method', 'property'].includes(p1)) {
      const memberName = p1 + ': ' + p2;
      const member = membersMap.get(memberName);
      if (!member)
        throw new Error('Undefined member references: ' + match);
      return linkRenderer({ member, href }) || match;
    }
    if (p1 === 'param') {
      let alias = p2;
      if (classOrMember) {
        // param/option reference can only be in method or same method parameter comments.
        const method = /** @type {Member} */(classOrMember).enclosingMethod;
        const param = method?.argsArray.find(a => a.name === p2);
        if (!param)
          throw new Error(`Referenced parameter ${match} not found in the parent method ${method?.name} `);
        alias = param.alias;
      }
      return linkRenderer({ param: alias, href }) || match;
    }
    if (p1 === 'option')
      return linkRenderer({ option: p2, href }) || match;
    throw new Error(`Undefined link prefix, expected event|method|property|param|option, got: ` + match);
  });
  text = text.replace(/\[([\w]+)\](?:\(([^)]*?)\))?/g, (match, p1, href) => {
    const clazz = classesMap.get(p1);
    if (clazz)
      return linkRenderer({ clazz, href }) || match;
    return match;
  });
  return text;
}

/**
 * @param {MarkdownNode[] | undefined} spec
 */
function generateSourceCodeComment(spec) {
  const comments = (spec || []).filter(n => !n.type.startsWith('h') && (n.type !== 'li' ||  n.liType !== 'default')).map(c => md.clone(c));
  md.visitAll(comments, node => {
    if (node.type === 'li' && node.liType === 'bullet')
      node.liType = 'default';
    if (node.type === 'code' && node.codeLang)
      node.codeLang = parseCodeLang(node.codeLang).highlighter;
    if (node.type === 'note') {
      // @ts-ignore
      node.type = 'text';
      node.text = '**NOTE** ' + node.text;
    }
  });
  // 5 is a typical member doc offset.
  return md.render(comments, { maxColumns: 120 - 5, omitLastCR: true, flattenText: true });
}

/**
 * @param {Member} optionsArg
 * @param {LanguageOptions=} options
 */
function patchCSharpOptionOverloads(optionsArg, options = {}) {
  const props = optionsArg.type?.properties;
  if (!props)
    return;
  const propsToDelete = new Set();
  const propsToAdd = [];
  for (const prop of props) {
    const union = prop.type?.union;
    if (!union)
      continue;
    const isEnum = union[0].name.startsWith('"');
    const isNullable = union.length === 2 && union.some(type => type.name === 'null');
    if (isEnum || isNullable)
      continue;

    const shortNotation = [];
    propsToDelete.add(prop);
    for (const type of union) {
      const suffix = csharpOptionOverloadSuffix(prop.name, type.name);
      if (options.csharpOptionOverloadsShortNotation) {
        if (type.name === 'string')
          shortNotation.push(prop.alias);
        else
          shortNotation.push(prop.alias + suffix);
        continue;
      }

      const newProp = prop.clone();
      newProp.name = prop.name + suffix;
      newProp.alias = prop.alias + suffix;
      newProp.type = type;
      propsToAdd.push(newProp);

      if (type.name === 'string') {
        const stringProp = prop.clone();
        stringProp.type = type;
        propsToAdd.push(stringProp);
      }
    }
    if (options.csharpOptionOverloadsShortNotation) {
      const newProp = prop.clone();
      newProp.alias = newProp.name = shortNotation.join('|');
      propsToAdd.push(newProp);
    }
  }
  for (const prop of propsToDelete)
    props.splice(props.indexOf(prop), 1);
  props.push(...propsToAdd);
}

/**
 * @param {string} option
 * @param {string} type
 */
function csharpOptionOverloadSuffix(option, type) {
  switch (type) {
    case 'string': return 'String';
    case 'RegExp': return 'Regex';
    case 'function': return 'Func';
    case 'Buffer': return 'Byte';
    case 'Serializable': return 'Object';
    case 'int': return 'Int';
    case 'long': return 'Int64';
    case 'Date': return 'Date';
  }
  throw new Error(`CSharp option "${option}" has unsupported type overload "${type}"`);
}

/**
 * @param {MarkdownNode[]} spec
 * @param {string} language
 * @param {CodeGroupTransformer} transformer
 * @returns {MarkdownNode[]}
 */
function processCodeGroups(spec, language, transformer) {
  /** @type {MarkdownNode[]} */
  const newSpec = [];
  for (let i = 0; i < spec.length; ++i) {
    /** @type {{value: string, groupId: string, spec: MarkdownNode}[]} */
    const tabs = [];
    for (;i < spec.length; i++) {
      const codeLang = spec[i].codeLang;
      if (!codeLang)
        break;
      let parsed;
      try {
        parsed = parseCodeLang(codeLang);
      } catch (e) {
        throw new Error(e.message + '\n while processing:\n' + md.render([spec[i]]));
      }
      if (!parsed.codeGroup)
        break;
      if (parsed.language && parsed.language !== language)
        continue;
      const [groupId, value] = parsed.codeGroup.split('-');
      const clone = md.clone(spec[i]);
      clone.codeLang = parsed.highlighter;
      tabs.push({ groupId, value, spec: clone });
    }
    if (tabs.length) {
      if (tabs.length === 1)
        throw new Error(`Lonely tab "${tabs[0].spec.codeLang}". Make sure there are at least two tabs in the group.\n` + md.render([tabs[0].spec]));

      // Validate group consistency.
      const groupId = tabs[0].groupId;
      const values = new Set();
      for (const tab of tabs) {
        if (tab.groupId !== groupId)
          throw new Error('Mixed group ids: ' + md.render(spec));
        if (values.has(tab.value))
          throw new Error(`Duplicated tab "${tab.value}"\n` + md.render(tabs.map(tab => tab.spec)));
        values.add(tab.value);
      }

      // Append transformed nodes.
      newSpec.push(...transformer(tabs));
    }
    if (i < spec.length)
      newSpec.push(spec[i]);
  }
  return newSpec;
}

/**
 * @param {string} codeLang
 * @return {{ highlighter: string, language: string|undefined, codeGroup: string|undefined}}
 */
function parseCodeLang(codeLang) {
  if (codeLang === 'python async')
    return { highlighter: 'py', codeGroup: 'python-async', language: 'python' };
  if (codeLang === 'python sync')
    return { highlighter: 'py', codeGroup: 'python-sync', language: 'python' };

  const [highlighter] = codeLang.split(' ');
  if (!highlighter)
    throw new Error(`Cannot parse code block lang: "${codeLang}"`);

  const languageMatch = codeLang.match(/ lang=([\w\d]+)/);
  let language = languageMatch ? languageMatch[1] : undefined;
  if (!language) {
    if (highlighter === 'ts')
      language = 'js';
    else if (highlighter === 'py')
      language = 'python';
    else if (['js', 'python', 'csharp', 'java'].includes(highlighter))
      language = highlighter;
  }

  const tabMatch = codeLang.match(/ tab=([\w\d-]+)/);
  return { highlighter, language, codeGroup: tabMatch ? tabMatch[1] : '' };
}

module.exports = { Documentation, Class, Member, Type, processCodeGroups, parseCodeLang };
