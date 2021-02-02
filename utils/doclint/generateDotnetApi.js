/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

const path = require('path');
const Documentation = require('./documentation');
const XmlDoc = require('./xmlDocumentation')
const PROJECT_DIR = path.join(__dirname, '..', '..');
const fs = require('fs');
const { parseApi } = require('./api_parser');
const { type } = require('os');
const { check } = require('proper-lockfile');
const { Type } = require('./documentation');
const { threadId } = require('worker_threads');
// const { visitAll } = require('../markdown'); // TODO: consider using this instead of manual parsing

const maxDocumentationColumnWidth = 120;

/** @type {Map<string, Documentation.Type>} */
const additionalTypes = new Map(); // this will hold types that we discover, because of .NET specifics, like results
/** @type {Map<string, string[]>} */
const enumTypes = new Map();

let documentation;
/** @type {Map<string, string>} */
let classNameMap;

{
  const typesDir = process.argv[2] || '../generate_types/csharp/';
  let checkAndMakeDir = (path) => {
    if (!fs.existsSync(path))
      fs.mkdirSync(path)
  };

  const modelsDir = path.join(typesDir, "models");
  const enumsDir = path.join(typesDir, "enums");

  checkAndMakeDir(typesDir);
  checkAndMakeDir(modelsDir);
  checkAndMakeDir(enumsDir);

  documentation = parseApi(path.join(PROJECT_DIR, 'docs', 'src', 'api'));
  documentation.filterForLanguage('csharp');

  // we'll handle this natively
  // documentation.copyDocsFromSuperclasses([]);

  documentation.setLinkRenderer(item => {
    if (item.clazz) {
      return `<see cref="${translateMemberName("interface", item.clazz.name, null)}"/>`;
    } else if (item.member) {
      return `<see cref="${translateMemberName("interface", item.member.clazz.name, null)}.${translateMemberName(item.member.kind, item.member.name, item.member)}"/>`;
    } else if (item.option) {
      return "{OPTION}";
    } else if (item.param) {
      return "{PARAM}";
    }
  });

  // get the template for a class
  const template = fs.readFileSync("./templates/interface.cs", 'utf-8')
    .replace('[PW_TOOL_VERSION]', `${__filename.substring(path.join(__dirname, '..', '..').length).split(path.sep).join(path.posix.sep)}`);

  // we have some "predefined" types, like the mixed state enum, that we can map in advance
  enumTypes.set("MixedState", ["On", "Off", "Mixed"]);

  // map the name to a C# friendly one (we prepend an I to denote an interface)
  // let name = translateMemberName('interface', element.name, undefined);
  classNameMap = new Map(documentation.classesArray.map(x => [x.name, translateMemberName('interface', x.name, null)]));

  // map some types that we know of
  classNameMap.set('Error', 'Exception');
  classNameMap.set('TimeoutError', 'TimeoutException');
  classNameMap.set('EvaluationArgument', 'object');
  classNameMap.set('boolean', 'bool');
  classNameMap.set('Serializable', 'T');
  classNameMap.set('any', 'T');
  classNameMap.set('Buffer', 'byte[]');
  classNameMap.set('function', 'Action');
  classNameMap.set('path', 'string');

  // this are types that we don't explicility render even if we get the specs
  const ignoredTypes = ['TimeoutException'];

  let writeFile = (name, out, folder) => {
    let content = template.replace('[CONTENT]', out.join("\r\n\t"));
    fs.writeFileSync(`${path.join(folder, name)}.cs`, content);
  }

  /**
   * 
   * @param {string} kind 
   * @param {string} name 
   * @param {Documentation.MarkdownNode[]} spec
   * @param {Function} callback 
   * @param {string} folder
   * @param {string} extendsName
   */
  let innerRenderElement = (kind, name, spec, callback, folder = typesDir, extendsName = null) => {
    const out = [];
    console.log(`Generating ${name}`);

    if (spec)
      out.push(...XmlDoc.renderXmlDoc(spec, maxDocumentationColumnWidth));

    if (extendsName === 'IEventEmitter')
      extendsName = null;

    out.push(`public ${kind} ${name}${extendsName ? ` : ${extendsName}` : ''}`);
    out.push('{');

    callback(out);

    out.push('}');

    writeFile(name, out, folder);
  };

  for (const element of documentation.classesArray) {
    const name = classNameMap.get(element.name);
    if (ignoredTypes.includes(name))
      continue;

    innerRenderElement('interface', name, element.spec, (out) => {
      for (const member of element.membersArray) {
        renderMember(member, element, out);
      }
    }, typesDir, translateMemberName('interface', element.extends, null));
  }

  additionalTypes.forEach((type, name) =>
    innerRenderElement('class', name, null, (out) => {
      // TODO: consider how this could be merged with the `translateType` check
      if (type.union
        && type.union[0].name === 'null'
        && type.union.length == 2) {
        type = type.union[1];
      }

      if (type.name === 'Array') {
        throw 'Array at this stage is unexpected.';
      } else if (type.properties) {
        for (const member of type.properties) {
          let fakeType = new Type(name, null);
          renderMember(member, fakeType, out);
        }
      } else {
        console.log(type);
        throw `Not sure what to do in this case.`;
      }
    }, modelsDir));

  enumTypes.forEach((values, name) =>
    innerRenderElement('enum', name, null, (out) => {
      values.forEach((v, i) => {
        // strip out the quotes
        v = v.replace(/[\"]/g, ``)
        let escapedName = v.replace(/[-]/g, ' ')
          .split(' ')
          .map(word => word[0].toUpperCase() + word.substring(1)).join('');

        out.push(`\t[EnumMember(Value = "${v}")]`);
        out.push(`\t${escapedName},`);
      });
    }, enumsDir));
}

/**
 * @param {string} memberKind  
 * @param {string} name 
 * @param {Documentation.Member} member */
function translateMemberName(memberKind, name, member = null) {
  if (!name) return name;

  // we strip it for special chars, like @ because we might get called back with it in some special cases
  // like, when generating classes inside methods for params
  name = name.replace(/[@-]/g, '');

  if (memberKind === 'argument') {
    if (['params', 'event'].includes(name)) { // just in case we want to add others
      return `@${name}`;
    } else {
      return name;
    }
  }
  // check if there's an alias in the docs, in which case
  // we return that, otherwise, we apply our dotnet magic to it
  if (member) {
    if (member.alias !== name) {
      return member.alias;
    }
  }

  let assumedName = name.charAt(0).toUpperCase() + name.substring(1);

  switch (memberKind) {
    case "interface":
      // apply name mapping if the map exists
      let mappedName = classNameMap ? classNameMap.get(assumedName) : null;
      if (mappedName)
        return mappedName;
      return `I${assumedName}`;
    case "method":
      if (member && member.async)
        return `${assumedName}Async`;
      return assumedName;
    case "event":
      return `On${assumedName}`;
    case "enum":
      return `${assumedName}`;
    default:
      return `${assumedName}`;
  }
}

/**
 * 
 * @param {Documentation.Member} member 
 * @param {Documentation.Class|Documentation.Type} parent 
 * @param {string[]} out
 */
function renderMember(member, parent, out) {
  let output = line => {
    if (typeof (line) === 'string')
      out.push(`\t${line}`);
    else
      out.push(...line);
  }

  let name = translateMemberName(member.kind, member.name, member);
  if (member.kind === 'method') {
    renderMethod(member, parent, output, name);
  } else {
    let type = translateType(member.type, parent, (t) => generateNameDefault(member, name, t, parent));
    if (member.kind === 'event') {
      if (!member.type)
        throw `No Event Type for ${name} in ${parent.name}`;
      // console.log(member.type);
      output(`event EventHandler<${type}> ${name};`);
    } else if (member.kind === 'property') {
      output(`${type} ${name} { get; set; }`);
    } else {
      throw `Problem rendering a member: ${type} - ${name} (${member.kind})`;
    }
  }
}

/**
 * 
 * @param {Documentation.Member} member 
 * @param {string} name 
 * @param {Documentation.Type} t 
 * @param {*} parent 
 */
function generateNameDefault(member, name, t, parent) {
  if (!t.properties
    && !t.templates
    && !t.union
    && t.expression === '[Object]')
    return 'object';

  // we'd get this call for enums, primarily
  let enumName = generateEnumNameIfApplicable(member, name, t, parent);
  if (!enumName && member) {
    if (member.kind === 'method' || member.kind === 'property') {
      // this should be easy to name... let's call it the same as the argument (eternal optimist)
      let probableName = `${parent.name}${translateMemberName(``, name, null)}`;
      let probableType = additionalTypes.get(probableName);
      if (probableType) {
        // compare it with what?
        if (probableType.expression != t.expression) {
          throw `Non-matching types with the same name. Panic.`;
        }
      } else {
        additionalTypes.set(probableName, t);
      }

      return probableName;
    }

    if (member.kind === 'event') {
      return `${name}Payload`;
    }
  }

  return enumName || t.name;
}

function generateEnumNameIfApplicable(member, name, type, parent) {
  if (!type.union || type.union.filter(u => u.name.startsWith(`"`)).length != type.union.length)
    return null; // this isn't an enum, so we don't care, we let the caller generate the name

  // our enum naming policy leaves a few bits to be desired, but it'll do for now
  return translateMemberName('enum', name);
}

/**
 * Rendering a method is so _special_, with so many weird edge cases, that it
 * makes sense to put it separate from the other logic. 
 * @param {Documentation.Member} member 
 * @param {Documentation.Class|Documentation.Type} parent 
 * @param {Function} output
 */
function renderMethod(member, parent, output, name) {
  let typeResolve = (type) => translateType(type, parent, (t) => {
    return `${parent.name}${translateMemberName(member.kind, member.name, null)}Result`;
  });

  /** @type {string} */
  let type = null;
  // need to check the original one
  if (member.type.name === 'Object' || member.type.name === 'Array') {
    let innerType = member.type;
    let isArray = false;
    if (innerType.name === 'Array') {
      // we want to influence the name, but also change the object type
      innerType = member.type.templates[0];
      isArray = true;
    }

    if (innerType.expression === '[Object]<[string], [string]>') {
      // do nothing, because this is handled down the road
    } else if (!innerType.properties) {
      type = `dynamic`;
    } else {
      type = typeResolve(innerType);
      additionalTypes.set(type, innerType);

      if (isArray)
        type = `${type}[]`;
    }
  }

  type = type || typeResolve(member.type); //translateType(member.type, parent);
  // TODO: this is something that will probably go into the docs
  if (member.args.size == 0
    && type !== 'void'
    && !name.startsWith('Is')
    && !name.startsWith('Get')) {
    name = `Get${name}`;
  }

  // HACK: special case for generics handling!
  if (type === 'T') {
    name = `${name}<T>`;
  }

  // adjust the return type for async methods
  if (member.async)
    if (type === 'void')
      type = `Task`;
    else
      type = `Task<${type}>`;

  // render args
  let args = [];
  let parseArg = (/** @type {Documentation.Member} */ arg) => {
    if (arg.name === "options") {
      arg.type.properties.forEach(prop => {
        parseArg(prop);
      });
      return;
    }

    if (arg.type.expression === '[boolean]|[Array]<[string]>') {
      // HACK: this hurts my brain too
      // we split this into two args, one boolean, with the logical name
      let argName = translateMemberName('argument', arg.name, null);
      let leftArgType = translateType(arg.type.union[0], parent, (t) => { throw 'Not supported'; });
      let rightArgType = translateType(arg.type.union[1], parent, (t) => { throw 'Not supported'; });

      args.push(`${leftArgType} ${argName}`);
      args.push(`${rightArgType} ${argName}Values`);

      return;
    }

    const argName = translateMemberName('argument', arg.name, null);
    const argType = translateType(arg.type, parent, (t) => generateNameDefault(member, argName, t, parent));

    args.push(`${argType} ${argName}`);
  };

  member.args.forEach(parseArg);

  output(XmlDoc.renderXmlDoc(member.spec, maxDocumentationColumnWidth).map(x => `\t${x}`));
  output(`${type} ${name}(${args.join(', ')});`);
}

/**
 * 
 *  @callback generateNameCallback
 *  @param {Documentation.Type} t
 *  @returns {string}
 */

/**
 *  @param {Documentation.Type} type 
 *  @param {Documentation.Class|Documentation.Type} parent
 *  @param {generateNameCallback} generateNameCallback
*/
function translateType(type, parent, generateNameCallback = null) {

  if (!generateNameCallback) {
    generateNameCallback = (t) => {
      return t.name;
    }
  }

  // a few special cases we can fix automatically
  if (type.expression === '[null]|[Error]') {
    return 'void';
  }

  if (type.union) {
    if (type.union[0].name === 'null') {
      // for dotnet, this is a nullable type
      // if the other side is a primitive type
      if (type.union.length > 2)
        throw `Union (${parent.name}) with null is too long.`;

      const innerTypeName = translateType(type.union[1], parent, generateNameCallback);
      // if type is primitive, or an enum, then it's nullable
      if (innerTypeName === 'bool'
        || innerTypeName === 'int') {
        return `${innerTypeName}?`;
      }

      // if it's not a value type, it'll be nullable by default, so we can ignore it
      return `${innerTypeName}`;
    }

    if (type.union.filter(u => u.name.startsWith(`"`)).length == type.union.length) {
      // this is an enum
      let enumName = generateNameCallback(type);
      if (!enumName)
        throw `This was supposed to be an enum, but it failed generating a name, ${type.name} ${parent ? parent.name : ""}.`;

      // make sure we map the enum, or invalidate the name, in case it doesn't match well
      const potentialEnum = enumTypes.get(enumName);
      let enumValues = type.union.map(x => x.name);
      if (potentialEnum) {
        // compare values
        if (potentialEnum.join(',') !== enumValues.join(',')) {
          // for now, we'll merge the two enums, if they have the same name, and we'll go from there
          potentialEnum.concat(enumValues.filter(x => !potentialEnum.includes(x))); // merge & de-dupe
          // TODO: think about doing global type annotation, where we can add comments, such as this?
          enumTypes.set(enumName, potentialEnum);
        }
      } else {
        enumTypes.set(enumName, enumValues);
      }
      return enumName;
    }

    if (type.expression === '[string]|[Buffer]')
      return `byte[]`; // TODO: make sure we implement extension methods for this!
    else if (type.expression === '[string]|[float]'
      || type.expression === '[string]|[float]|[boolean]'
      || (type.union && type.union[0].name === 'string' && type.union[1].name === 'float' && type.union[2].name === 'boolean'))
      return 'string'; // because users can send either 100 or 100px for most of these arguments
    else if (type.union.length == 2 && type.union[1].name === 'Array' && type.union[1].templates[0].name === type.union[0].name)
      return `${type.union[0].name}[]`; // an example of this is [string]|[Array]<[string]>
    else if (type.union[0].name === 'path')
      // we don't support path, but we know it's usually an object on the other end, and we expect
      // the dotnet folks to use [NameOfTheObject].LoadFromPath(); method which we can provide separately
      return translateType(type.union[1], parent, generateNameCallback);
    else if (type.expression === '[float]|"raf"')
      return `Polling`; // hardcoded because there's no other way to denote this


    console.log(`Not sure how to parse union ${type.name} in ${parent ? parent.name : '<<no parent>>'}:`);
    console.log(type);

    return `Union`;
  }

  if (type.name === 'Array') {
    if (type.templates.length != 1)
      throw `Array (${type.name} from ${parent.name}) has more than 1 dimension. Panic.`;

    let innerType = translateType(type.templates[0], parent, generateNameCallback);
    return `${innerType}[]`;
  }

  if (type.name === 'Object') {
    // take care of some common cases
    // TODO: this can be genericized
    if (type.templates && type.templates.length == 2) {
      // get the inner types of both templates, and if they're strings, it's a keyvaluepair string, string, 
      let keyType = translateType(type.templates[0], parent, generateNameCallback);
      let valueType = translateType(type.templates[1], parent, generateNameCallback);
      return `IEnumerable<KeyValuePair<${keyType}, ${valueType}>>`;
    }

    if ((type.name === 'Object')
      && !type.properties
      && !type.union) {
      return 'object';
    }
    // this is an additional type that we need to generate
    let objectName = generateNameCallback(type);
    if (objectName === 'Object') {
      throw 'Object unexpected';
    } else if (type.name === 'Object') {
      registerAdditionalType(objectName, type);
    }

    if (['object'].includes(objectName))
      return objectName;

    return objectName;
  }

  if (type.name === 'Map') {
    if (type.templates && type.templates.length == 2) {
      // we map to a dictionary
      let keyType = translateType(type.templates[0], parent, generateNameCallback);
      let valueType = translateType(type.templates[1], parent, generateNameCallback);
      return `Dictionary<${keyType}, ${valueType}>`;
    } else {
      throw 'Map has invalid number of templates.';
    }
  }

  // there's a chance this is a name we've already seen before, so check
  // this is also where we map known types, like boolean -> bool, etc.
  let name = classNameMap.get(type.name) || type.name;
  return `${name}`;
}

/**
 * 
 * @param {string} typeName 
 * @param {Documentation.Type} type 
 */
function registerAdditionalType(typeName, type) {
  if (['object', 'string', 'int'].includes(typeName))
    return;

  let potentialType = additionalTypes.get(typeName);
  if (potentialType) {
    console.log(`Type ${typeName} already exists, so skipping...`);
    return;
  }

  additionalTypes.set(typeName, type);
}