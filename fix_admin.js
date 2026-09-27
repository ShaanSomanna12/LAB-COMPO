const fs = require('fs');
const path = 'e:/LAB COMPONENTS/frontend/src/app/admin/page.tsx';
let data = fs.readFileSync(path, 'utf8');

// Replace all occurrences of `<h... className={`${spaceGrotesk.className} ... ">`
// with `<h... className={`${spaceGrotesk.className} ... `}>`
data = data.replace(/(<h[1-6] className=\{\`\$\{spaceGrotesk\.className\} [^\`]+?)\">/g, '$1`}>');

fs.writeFileSync(path, data);
console.log('Fixed JSX syntax!');
