
{ config, lib, pkgs, ... }:

with lib;

let
    moin = pkgs.python3.pkgs.buildPythonApplication {
      pname = "moin";
      version = "unstable-20230213a";

      src = lib.cleanSource ./.; 

      propagatedBuildInputs = with pkgs.python3Packages; [
        # for parser.py
        bottle
        pandas

        # for logger.py
        twisted
        pyopenssl
        service-identity
      ];

      meta = {
        homepage = https://github.com/hackspace.marburg/moin;
        description = "moin";
        license = lib.licenses.gpl3;
      };

      installPhase = ''
        mkdir -p $out/bin
        cp $src/logger.py $out/bin
        cp $src/parser.py $out/bin
      '';

    };

    moin-uid = 9161;

    moinConfig = pkgs.writeText "config.toml" ''
        port = '${toString cfg.port}'
        path = '${cfg.path}'
    '';

    cfg = config.services.moin;

in {
  options.services.moin = {
    enable = mkEnableOption "moin";

    port = mkOption {
      default = 80;
      type = types.port;
      description = "Server port for bottlepy";
    };

    path = mkOption {
      default = "/var/lib/moin";
      type = types.path;
      description = "Directory for moin's store";
    };

  };

  config = mkIf cfg.enable {
    environment.systemPackages = [ moin ];

    systemd.services.moin-logger = {
      description = "moin-logger";

      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        ExecStart = ''
          ${moin}/bin/logger.py \
            --path ${cfg.path}
        '';

        Type = "simple";

        User = "moin";
        Group = "moin";
      };
    };

    systemd.services.moin-parser = {
      description = "moin-parser";

      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        ExecStart = ''
          ${moin}/bin/parser.py \
            --path ${cfg.path} \ 
            --port ${cfg.port}
        '';

        Type = "simple";

        User = "moin";
        Group = "moin";
      };
    };


    users.users.moin = {
      group = "moin";
      home = cfg.serverPath;
      createHome = true;
      uid = moin-uid;
    };

    users.groups.moin.gid = moin-uid;

  };

}
