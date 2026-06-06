import zipfile
import json
import os
import subprocess

def main():
    print("Fetching function metadata...")
    cmd = ["aws", "lambda", "get-function", "--function-name", "serverlessclaw-prod-HighPowerMultiplexerFunction-bxnmkztm", "--region", "ap-southeast-2", "--profile", "aiready"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("Error getting function:", res.stderr)
        return
    
    meta = json.loads(res.stdout)
    url = meta["Code"]["Location"]
    
    zip_path = "/tmp/multiplexer-code.zip"
    print(f"Downloading lambda code using curl to {zip_path}...")
    curl_cmd = ["curl", "-s", "-o", zip_path, url]
    subprocess.run(curl_cmd, check=True)
    
    extract_dir = "/tmp/multiplexer-extracted"
    os.makedirs(extract_dir, exist_ok=True)
    print(f"Extracting to {extract_dir}...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
        
    bundle_path = os.path.join(extract_dir, "bundle.mjs")
    print(f"Reading {bundle_path}...")
    with open(bundle_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    target_pattern = """          let configTable;
          let memoryTable;
          let buildProject = process.env.DEPLOYER_PROJECT_NAME;
          try {
            const typedResource2 = Resource;
            configTable = typedResource2.ConfigTable?.name;
            memoryTable = typedResource2.MemoryTable?.name;
            buildProject = typedResource2.SelfDeployProject?.name || typedResource2.Deployer?.name || buildProject;
          } catch (e20) {
            logger.warn("[Deployment] Defensive resource access failed, falling back to env:", e20);
          }"""

    replacement = """          let configTable;
          let memoryTable;
          let buildProject = process.env.DEPLOYER_PROJECT_NAME;
          try {
            configTable = Resource.ConfigTable?.name;
          } catch (e) {}
          try {
            memoryTable = Resource.MemoryTable?.name;
          } catch (e) {}
          try {
            buildProject = Resource.Deployer?.name;
          } catch (e) {}
          try {
            buildProject = buildProject || Resource.SelfDeployProject?.name;
          } catch (e) {}
          if (!configTable) {
            configTable = process.env.CONFIG_TABLE_NAME;
          }
          if (!memoryTable) {
            memoryTable = process.env.MEMORY_TABLE_NAME;
          }"""

    if target_pattern not in content:
        print("Could not find the target pattern in bundle.mjs!")
        return
        
    print("Replacing pattern in bundle.mjs...")
    content = content.replace(target_pattern, replacement)
    
    with open(bundle_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print("Re-packing zip file...")
    new_zip_path = "/tmp/multiplexer-patched.zip"
    with zipfile.ZipFile(new_zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
        for root, _, files in os.walk(extract_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, extract_dir)
                zip_ref.write(file_path, arcname)
                
    print(f"Uploading patched zip to AWS lambda serverlessclaw-prod-HighPowerMultiplexerFunction-bxnmkztm...")
    upload_cmd = ["aws", "lambda", "update-function-code", 
                  "--function-name", "serverlessclaw-prod-HighPowerMultiplexerFunction-bxnmkztm",
                  "--zip-file", f"fileb://{new_zip_path}",
                  "--region", "ap-southeast-2",
                  "--profile", "aiready"]
    upload_res = subprocess.run(upload_cmd, capture_output=True, text=True)
    if upload_res.returncode != 0:
        print("Upload failed:", upload_res.stderr)
        return
        
    print("✅ Lambda hotpatch applied successfully!")

if __name__ == "__main__":
    main()
