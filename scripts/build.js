const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('child_process');
const debounce = require('./utils/debounce');

const PATH_SRC = path.join(__dirname, '..', 'src');
const watch = process.argv.find(a => a.startsWith('--watch'));

const cmd = [
    '.\\node_modules\\.bin\\esbuild',
    'src/index.ts',
    '--bundle',
    '--minify',
    '--sourcemap',
    '--outfile=dist/three.viewport.min.js',
];

if (watch)
    cmd.splice(cmd.length - 1, 0, '--sourcemap');

const build = () => {
    console.clear();
    try {
        execSync(cmd.join(' '), { stdio: 'inherit' });
    }
    // stdio is inherited, so we shouldn't need to do anything here
    catch (ex) { }
};

if (watch) {
    fs.watch(PATH_SRC, {}, debounce((eventType) => {
        if (eventType === 'change')
            build();
    }, 500));
}

build();
