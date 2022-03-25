import core from './core';
import javascript from './languages/javascript';
import python from './languages/python';
import csharp from './languages/csharp';
import java from './languages/java';

core.registerLanguage('javascript', javascript);
core.registerLanguage('python', python);
core.registerLanguage('csharp', csharp);
core.registerLanguage('java', java);

export default core;
