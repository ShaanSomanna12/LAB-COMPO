const fs = require('fs');

function fixAdmin() {
  const path = 'e:\\LAB COMPONENTS\\frontend\\src\\app\\admin\\page.tsx';
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/toast\.success\("Return request submitted with geotag proof\."\);/g, 'toast.success("Return request submitted.");');
  content = content.replace(/alt="Geotag Proof"/g, 'alt="Proof"');
  content = content.replace(/\{req\.geotagImageUrl && \([\s\S]*?<\/button>\r?\n\s*\)\}/g, '');
  content = content.replace(/\{previewType === 'RETURN' \? 'Geotagged Return Proof' : 'Geotagged Collection Proof'\}/g, "{previewType === 'RETURN' ? 'Return Proof' : 'Collection Proof'}");
  content = content.replace(/Geotag Image Preview Modal/g, 'Image Preview Modal');
  fs.writeFileSync(path, content, 'utf8');
}

function fixReservations() {
  const path = 'e:\\LAB COMPONENTS\\frontend\\src\\app\\student\\reservations\\page.tsx';
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/toast\.success\("Return request submitted with geotag proof\."\);/g, 'toast.success("Return request submitted.");');
  content = content.replace(/alt="Geotag Proof"/g, 'alt="Proof"');
  fs.writeFileSync(path, content, 'utf8');
}

fixAdmin();
fixReservations();
