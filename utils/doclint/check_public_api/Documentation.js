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

class Documentation {
  /**
   * @param {!Array<!Documentation.Class>} classesArray
   */
  constructor(classesArray) {
    this.classesArray = classesArray;
    /** @type {!Map<string, !Documentation.Class>} */
    this.classes = new Map();
    for (const cls of classesArray)
      this.classes.set(cls.name, cls);
  }
}

Documentation.Class = class {
  /**
   * @param {string} name
   * @param {!Array<!Documentation.Member>} membersArray
   * @param {?string=} extendsName
   * @param {string=} comment
   * @param {string[]=} templates
   */
  constructor(name, membersArray, extendsName = null, comment = '', templates = []) {
    this.name = name;
    this.membersArray = membersArray;
    this.comment = comment;
    this.extends = extendsName;
    this.templates = templates;
    this.index();
  }

  index() {
    /** @type {!Map<string, !Documentation.Member>} */
    this.members = new Map();
    /** @type {!Map<string, !Documentation.Member>} */
    this.properties = new Map();
    /** @type {!Array<!Documentation.Member>} */
    this.propertiesArray = [];
    /** @type {!Map<string, !Documentation.Member>} */
    this.methods = new Map();
    /** @type {!Array<!Documentation.Member>} */
    this.methodsArray = [];
    /** @type {!Map<string, !Documentation.Member>} */
    this.events = new Map();
    /** @type {!Array<!Documentation.Member>} */
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
    }
  }

  validateOrder(errors, cls) {
    const members = this.membersArray;
    // Events should go first.
    let eventIndex = 0;
    for (; eventIndex < members.length && members[eventIndex].kind === 'event'; ++eventIndex);
    for (; eventIndex < members.length && members[eventIndex].kind !== 'event'; ++eventIndex);
    if (eventIndex < members.length)
      errors.push(`Events should go first. Event '${members[eventIndex].name}' in class ${cls.name} breaks order`);

    // Constructor should be right after events and before all other members.
    const constructorIndex = members.findIndex(member => member.kind === 'method' && member.name === 'constructor');
    if (constructorIndex > 0 && members[constructorIndex - 1].kind !== 'event')
      errors.push(`Constructor of ${cls.name} should go before other methods`);

    // Events should be sorted alphabetically.
    for (let i = 0; i < members.length - 1; ++i) {
      const member1 = this.membersArray[i];
      const member2 = this.membersArray[i + 1];
      if (member1.kind !== 'event' || member2.kind !== 'event')
        continue;
      if (member1.name > member2.name)
        errors.push(`Event '${member1.name}' in class ${this.name} breaks alphabetic ordering of events`);
    }

    // All other members should be sorted alphabetically.
    for (let i = 0; i < members.length - 1; ++i) {
      const member1 = this.membersArray[i];
      const member2 = this.membersArray[i + 1];
      if (member1.kind === 'event' || member2.kind === 'event')
        continue;
      if (member1.kind === 'method' && member1.name === 'constructor')
        continue;
      if (member1.name.replace(/^\$+/, '$') > member2.name.replace(/^\$+/, '$')) {
        let memberName1 = `${this.name}.${member1.name}`;
        if (member1.kind === 'method')
          memberName1 += '()';
        let memberName2 = `${this.name}.${member2.name}`;
        if (member2.kind === 'method')
          memberName2 += '()';
        errors.push(`Bad alphabetic ordering of ${this.name} members: ${memberName1} should go after ${memberName2}`);
      }
    }
  }
};

Documentation.Member = class {
  /**
   * @param {string} kind
   * @param {string} name
   * @param {?Documentation.Type} type
   * @param {!Array<!Documentation.Member>} argsArray
   * @param {string=} comment
   * @param {string=} returnComment
   * @param {boolean=} required
   * @param {string[]=} templates
   */
  constructor(kind, name, type, argsArray, comment = '', returnComment = '', required = true, templates = []) {
    this.kind = kind;
    this.name = name;
    this.type = type;
    this.comment = comment;
    this.returnComment = returnComment;
    this.argsArray = argsArray;
    this.required = required;
    this.templates = templates;
    /** @type {!Map<string, !Documentation.Member>} */
    this.args = new Map();
    for (const arg of argsArray)
      this.args.set(arg.name, arg);
  }

  /**
   * @param {string} name
   * @param {!Array<!Documentation.Member>} argsArray
   * @param {?Documentation.Type} returnType
   * @param {string=} returnComment
   * @param {string=} comment
   * @param {string[]=} templates
   * @return {!Documentation.Member}
   */
  static createMethod(name, argsArray, returnType, returnComment, comment, templates) {
    return new Documentation.Member('method', name, returnType, argsArray, comment, returnComment, undefined, templates);
  }

  /**
   * @param {string} name
   * @param {!Documentation.Type} type
   * @param {string=} comment
   * @param {boolean=} required
   * @return {!Documentation.Member}
   */
  static createProperty(name, type, comment, required) {
    return new Documentation.Member('property', name, type, [], comment, undefined, required);
  }

  /**
   * @param {string} name
   * @param {?Documentation.Type=} type
   * @param {string=} comment
   * @return {!Documentation.Member}
   */
  static createEvent(name, type = null, comment) {
    return new Documentation.Member('event', name, type, [], comment);
  }
};

Documentation.Type = class {
  /**
   * @param {string} name
   * @param {!Array<!Documentation.Member>=} properties
   */
  constructor(name, properties = []) {
    this.name = name;
    this.properties = properties;
  }
};

module.exports = Documentation;

