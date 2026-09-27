const fs = require('fs');
const path = 'e:\\LAB COMPONENTS\\frontend\\src\\app\\student\\reservations\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove interfaces and state
content = content.replace(/geotag_image_url:\s*string\s*\|\s*null;\r?\n/g, '');
content = content.replace(/latitude\?:\s*number;\r?\n/g, '');
content = content.replace(/longitude\?:\s*number;\r?\n/g, '');
content = content.replace(/const \[addresses, setAddresses\].*?;\r?\n/g, '');
content = content.replace(/const \[uploadedReturnProof, setUploadedReturnProof\].*?;\r?\n/g, '');
content = content.replace(/const fileInputRef = useRef<HTMLInputElement>\(null\);\r?\n/g, '');
content = content.replace(/<input type="file" accept="image\/\*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" \/>\r?\n/g, '');

// 2. Remove fetch query fields
content = content.replace(/geotag_image_url,\r?\n/g, '');
content = content.replace(/latitude,\r?\n/g, '');
content = content.replace(/longitude,\r?\n/g, '');

// 3. Remove useEffect for resolveAddresses
const useEffectRegex = /useEffect\(\(\) => \{\s*const resolveAddresses = async \(\) => \{[\s\S]*?\}\s*\}, \[reservations\]\);\r?\n/;
content = content.replace(useEffectRegex, '');

// 4. Remove getAddress function
const getAddressRegex = /const getAddress = \(lat\?: number, lon\?: number\) => \{[\s\S]*?return addresses\[key\].*?;\r?\n\s*};\r?\n/;
content = content.replace(getAddressRegex, '');

// 5. Replace handleCollectClick
const handleCollectRegex = /const handleCollectClick = \(resId: string\) => \{[\s\S]*?if \(fileInputRef\.current\) \{[\s\S]*?\}\r?\n\s*};\r?\n/;
content = content.replace(handleCollectRegex, `const handleCollectClick = async (resId: string) => {
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/requests', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': \`Bearer \${token}\` } : {})
        },
        body: JSON.stringify({ id: resId, status: 'READY_FOR_PICKUP' })
      });
      if (!res.ok) throw new Error("Failed to update reservation status.");
      toast.success("Ready for pickup. Waiting for admin confirmation!");
      fetchReservations();
    } catch (err: any) {
      console.error(err);
      toast.error(\`Error: \${err.message}\`);
    } finally {
      setUploading(false);
    }
  };\n`);

// 6. Update submitReturn
content = content.replace(/if \(!uploadedReturnProof\) \{\r?\n\s*toast\.error\("Please capture and upload return proof geotag image first\."\);\r?\n\s*return;\r?\n\s*\}/g, '');
content = content.replace(/geotag: uploadedReturnProof/g, '');
content = content.replace(/setUploadedReturnProof\(null\);/g, '');

// 7. Remove compressImage and handleFileChange
const compressRegex = /const compressImage = \([\s\S]*?reader\.readAsDataURL\(file\);\r?\n\s*\}\);\r?\n\s*};\r?\n/;
content = content.replace(compressRegex, '');

const handleFileChangeRegex = /const handleFileChange = async \([\s\S]*?if \(fileInputRef\.current\) fileInputRef\.current\.value = '';\r?\n\s*\}\r?\n\s*};\r?\n/;
content = content.replace(handleFileChangeRegex, '');

// 8. Update Instructions Box
const instructionsRegex = /Finally, you will need to upload a geotagged image of the component to complete the collection process\./g;
content = content.replace(instructionsRegex, 'Finally, collect the component from the lab admin.');

// 9. Remove Proof Geotag UI
const proofGeotagRegex = /\{res\.latitude && res\.longitude && \([\s\S]*?<MapPin className="w-3\.5 h-3\.5" \/> Proof Geotag[\s\S]*?\{\w*getAddress\([\s\S]*?\}[\s\S]*?<\/div>\r?\n\s*\)\}/g;
content = content.replace(proofGeotagRegex, '');

// 10. Update 'Collect & Geotag' button
content = content.replace(/<Camera className="w-5 h-5" \/> Collect & Geotag/g, 'Collect Component');

// 11. Update 'Take Return Photo' to just submit directly
// Actually return Modal already has a "Submit" button which relies on `!uploadedReturnProof` to be disabled.
// I should remove `disabled={!uploadedReturnProof}`
content = content.replace(/disabled=\{!uploadedReturnProof\}/g, '');

// 12. Remove the return photo upload button in return modal
const returnPhotoUploadBtnRegex = /\{uploadedReturnProof \? \([\s\S]*?<Camera className="w-5 h-5" \/> Take Return Photo\r?\n\s*<\/button>\r?\n\s*\)\}/;
content = content.replace(returnPhotoUploadBtnRegex, '');
// Since we removed uploadedReturnProof state, it might be better to just remove that whole `<div className="mb-8">...</div>` block
const returnPhotoDivRegex = /<div className="mb-8">\s*\{uploadedReturnProof \? \([\s\S]*?<\/button>\s*\)\}\s*<\/div>/;
content = content.replace(returnPhotoDivRegex, '');

// 13. MapPin import remove
content = content.replace(/MapPin, /g, '');

fs.writeFileSync(path, content, 'utf8');
console.log('updated reservations page');
