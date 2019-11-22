// @ts-check
const path = require('path');
const fs = require('fs');

async function generateChromeProtocol(revision) {
  const outputPath = path.join(__dirname, '..', '..', 'src', 'chromium', 'protocol.d.ts');
  if (revision.local && fs.existsSync(outputPath))
    return;
  const playwright = await require('../../chromium');
  const browser = await playwright.launch({executablePath: revision.executablePath});
  const origin = browser.chromium.wsEndpoint().match(/ws:\/\/([0-9A-Za-z:\.]*)\//)[1];
  const page = await browser.newPage();
  await page.goto(`http://${origin}/json/protocol`);
  const json = JSON.parse(await page.evaluate(() => document.documentElement.innerText));
  const version = await browser.version();
  await browser.close();
  fs.writeFileSync(outputPath, jsonToTS(json));
  console.log(`Wrote protocol.d.ts for ${version} to ${path.relative(process.cwd(), outputPath)}`);
}


async function generateWebKitProtocol(revision) {
  const outputPath = path.join(__dirname, '..', '..', 'src', 'webkit', 'protocol.d.ts');
  if (revision.local && fs.existsSync(outputPath))
    return;
  const json = JSON.parse(fs.readFileSync(path.join(revision.folderPath, 'protocol.json'), 'utf8'));
  fs.writeFileSync(outputPath, jsonToTS({domains: json}));
  console.log(`Wrote protocol.d.ts for WebKit to ${path.relative(process.cwd(), outputPath)}`);
}

function jsonToTS(json) {
  return `// This is generated from /utils/protocol-types-generator/index.js
type binary = string;
export module Protocol {${json.domains.map(domain => `${domain.description ? `
  /**
   * ${domain.description}
   */` : ''}
  export module ${domain.domain} {${(domain.types || []).map(type => `${type.description ? `
    /**
     * ${type.description}
     */` : ''}${type.properties ? `
    export interface ${type.id} {${(type.properties || []).map(property => `${property.description ? `
      /**
       * ${property.description}
       */` : ''}
      ${property.name}${property.optional ? '?' : ''}: ${typeOfProperty(property)};`).join(``)}
    }` : `
    export type ${type.id} = ${typeOfProperty(type)};`}`).join('')}
    ${(domain.events || []).map(event => `${event.description ? `
    /**
     * ${event.description}
     */` : ''}${event.parameters ? `
    export type ${event.name}Payload = {${event.parameters.map(parameter => `${parameter.description ? `
      /**
       * ${parameter.description}
       */` : ''}
      ${parameter.name}${parameter.optional ? '?' : ''}: ${typeOfProperty(parameter)};`).join(``)}
    }` : `
    export type ${event.name}Payload = void;`}`).join('')}
    ${(domain.commands || []).map(command => `${command.description ? `
    /**
     * ${command.description}
     */` : ''}
    export type ${command.name}Parameters = {${(command.parameters || []).map(parameter => `${parameter.description ? `
      /**
       * ${parameter.description}
       */` : ''}
      ${parameter.name}${parameter.optional ? '?' : ''}: ${typeOfProperty(parameter)};`).join(``)}
    }
    export type ${command.name}ReturnValue = {${(command.returns || []).map(retVal => `${retVal.description ? `
      /**
       * ${retVal.description}
       */` : ''}
      ${retVal.name}${retVal.optional ? '?' : ''}: ${typeOfProperty(retVal)};`).join(``)}
    }`).join('')}
  }
  `).join('')}
  export interface Events {${json.domains.map(domain => (domain.events || []).map(event => `
    "${domain.domain}.${event.name}": ${domain.domain}.${event.name}Payload;`).join('')).join('')}
  }
  export interface CommandParameters {${json.domains.map(domain => (domain.commands || []).map(command => `
    "${domain.domain}.${command.name}": ${domain.domain}.${command.name}Parameters;`).join('')).join('')}
  }
  export interface CommandReturnValues {${json.domains.map(domain => (domain.commands || []).map(command => `
    "${domain.domain}.${command.name}": ${domain.domain}.${command.name}ReturnValue;`).join('')).join('')}
  }
}
`;
}


/**
 * @typedef {Object} Property
 * @property {string=} $ref
 * @property {!Array=} enum
 * @property {string=} type
 * @property {!Property=} items
 * @property {string=} description
 */

/**
 * @param {!Property} property
 * @param {string=} domain
 */
function typeOfProperty(property, domain) {
  if (property.$ref) return property.$ref.includes('.') || !domain ? property.$ref : domain + '.' + property.$ref;
  if (property.enum) return property.enum.map(value => JSON.stringify(value)).join('|');
  switch (property.type) {
    case 'array':
      return typeOfProperty(property.items, domain) + '[]';
    case 'integer':
      return 'number';
  }
  return property.type;
}

module.exports = {generateChromeProtocol, generateWebKitProtocol};