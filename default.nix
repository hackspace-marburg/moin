{ config, lib, pkgs, ... }:

with lib;

let
    moin = pkgs.python3.pkgs.buildPythonApplication {
      pname = "moin";
      version = "unstable-20230213a";

      src = lib.cleanSource ./.; 

      propagatedBuildInputs = with pkgs.python3Packages; [
        twisted
        pyopenssl
        service-identity
      ];

      meta = {
        homepage = https://github.com/hackspace-marburg/moin;
        description = "moin";
        license = lib.licenses.gpl3;
      };

      installPhase = ''
        mkdir -p $out/bin
        cp $src/logger.py $out/bin
        chmod +x $out/bin/logger.py
      '';

    };

    moin-uid = 8014;

    cfg = config.services.moin;

    parser = pkgs.writeShellScript "parser.sh" ''
      while ${pkgs.inotifyTools}/bin/inotifywait ${cfg.storePath}/scoreboard.csv; do
        export TOTAL=$(${pkgs.coreutils}/bin/wc -l < ${cfg.storePath}/scoreboard.csv)
        echo $TOTAL > /var/www/moin/index.html
        cat ${cfg.storePath}/scoreboard.csv | ${pkgs.python3}/bin/python3 -c 'import csv, json, sys; print(json.dumps([dict(r) for r in csv.DictReader(sys.stdin)]))' > /var/www/moin/full.json
      done
    '';

in {
  options.services.moin = {
    enable = mkEnableOption "moin";

    storePath = mkOption {
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
            --path ${cfg.storePath}
        '';

        Type = "simple";

        User = "moin";
        Group = "moin";
      };
    };

    systemd.services.moin-parser = {
      description = "moin-parser";

      after = [ "network.target" ];
      wantedBy = [ "default.target" ];

      serviceConfig = {
        Restart = "always";
        ExecStart = ''
          ${parser}
        '';

        Type = "simple";

        User = "moin";
        Group = "users";
      };
    };

    users.users.moin = {
      group = "moin";
      home = cfg.storePath;
      createHome = true;
      uid = moin-uid;
    };

    users.groups.moin.gid = moin-uid;

    users.users.nginx.extraGroups = [ "moin" ];

  };

}
