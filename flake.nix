{
  description = "中秋大胃王 (Moon Festival Catch & Eat) — WebCam face-tracking game";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          # 零建構專案:原生 ESM + importmap,毋須打包器。
          # 僅需 node 執行靜態伺服器,mkcert 產生手機 HTTPS 憑證。
          packages = with pkgs; [
            nodejs_24
            just
            mkcert # 產生本機憑證,供手機以 HTTPS 存取鏡頭
          ];

          shellHook = ''
            echo "🥮 中秋大胃王 dev shell (zero-build)"
            echo "  just dev       # 桌機開發 (http://localhost:5173)"
            echo "  just cert      # 產生手機測試用 HTTPS 憑證"
            echo "  just dev-tls   # 手機測試 (https,同網段可連)"
          '';
        };
      });
}
