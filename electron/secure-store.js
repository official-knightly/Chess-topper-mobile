const fs=require("node:fs");
const path=require("node:path");
class SecureStore{
 constructor({safeStorage,userDataPath}){this.safeStorage=safeStorage;this.file=path.join(userDataPath,"credentials.bin");}
 save(key,value){if(!this.safeStorage.isEncryptionAvailable())throw new Error("OS-backed secure storage is unavailable.");let data={};try{data=JSON.parse(fs.readFileSync(this.file,"utf8"));}catch{}data[key]=this.safeStorage.encryptString(String(value)).toString("base64");fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(data),{mode:0o600});}
 get(key){if(!this.safeStorage.isEncryptionAvailable())throw new Error("OS-backed secure storage is unavailable.");let data;try{data=JSON.parse(fs.readFileSync(this.file,"utf8"));}catch{return null;}const value=data[key];return value?this.safeStorage.decryptString(Buffer.from(value,"base64")):null;}
 delete(key){let data;try{data=JSON.parse(fs.readFileSync(this.file,"utf8"));}catch{return;}delete data[key];fs.writeFileSync(this.file,JSON.stringify(data),{mode:0o600});}
}
module.exports={SecureStore};
