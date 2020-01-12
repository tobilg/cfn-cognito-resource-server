const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const Terser = require('terser');

const cloudFormationTemplate = readFileSync(join(__dirname, '../src', 'cloudformation.template.yml'), { encoding: 'utf8' });
const serverlessTemplate = readFileSync(join(__dirname, '../src', 'serverless.template.yml'), { encoding: 'utf8' });
const src = readFileSync(join(__dirname, '../src', 'index.js'), { encoding: 'utf8' });

const code = {
    'index.js': src
};
const options = {
    toplevel: false,
    compress: {
        passes: 2
    },
    output: {
        beautify: true,
        keep_quoted_props: true,
        quote_style: 1,
        max_line_len: 150,
        indent_level: 2,
        indent_start: 10
    }
};

console.log('Building...')

const minifiedCode = Terser.minify(code, options).code;
console.log(' * Minifed Lambda source code');

const populateCloudFormationTemplate = cloudFormationTemplate.replace('$SOURCE', minifiedCode);
console.log(' * Populated CloudFormation template');

writeFileSync(join(__dirname, '../dist', 'cfn-cognito-resource-server.yml'), populateCloudFormationTemplate, { encoding: 'utf8' });
console.log(' * Wrote custom CloudFormation resource template.');

const populateServerlessTemplate = serverlessTemplate.replace('$SOURCE', minifiedCode);
console.log(' * Populated Serverless-compatible template');

writeFileSync(join(__dirname, '../dist', 'sls-cognito-resource-server.yml'), populateServerlessTemplate, { encoding: 'utf8' });
console.log(' * Wrote custom Serverless-compatible resource template.');

console.log('...Finished!');
