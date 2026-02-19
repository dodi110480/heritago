<?php

/**
 * webtrees: online genealogy
 * Copyright (C) 2026 webtrees development team
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

declare(strict_types=1);

namespace Fisharebest\Webtrees\Cli;

use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Webtrees;
use Symfony\Component\Console\Application;
use Throwable;

use function parse_ini_file;

final class Console extends Application
{
    private const array COMMANDS = [
        Commands\CompilePoFiles::class,
        Commands\ConfigIni::class,
        Commands\SiteOffline::class,
        Commands\SiteOnline::class,
        Commands\SiteSetting::class,
        Commands\TreeEdit::class,
        Commands\TreeExport::class,
        Commands\TreeImport::class,
        Commands\TreeList::class,
        Commands\TreeSetting::class,
        Commands\UserEdit::class,
        Commands\UserList::class,
        Commands\UserSetting::class,
        Commands\UserTreeSetting::class,
    ];

    public function __construct()
    {
        parent::__construct(name: Webtrees::NAME, version: Webtrees::VERSION);
    }

    public function loadCommands(): self
    {
        foreach (self::COMMANDS as $command) {
            $this->addCommand(command: Registry::container()->get($command));
        }

        return $this;
    }

    public function bootstrap(): self
    {
        I18N::init(code: 'en-US', setup: true);

        try {
            $config = [];

            // 1. Read .env file
            $env_file = Webtrees::ROOT_DIR . '.env';
            if (file_exists($env_file)) {
                $lines = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    $line = trim($line);
                    if ($line === '' || str_starts_with($line, '#'))
                        continue;
                    if (str_contains($line, '=')) {
                        [$name, $value] = explode('=', $line, 2);
                        $name = trim($name);
                        $value = trim($value, " \t\n\r\0\x0B\"'");

                        $key_map = [
                            'DB_TYPE' => 'dbtype',
                            'DB_HOST' => 'dbhost',
                            'DB_PORT' => 'dbport',
                            'DB_NAME' => 'dbname',
                            'DB_USER' => 'dbuser',
                            'DB_PASS' => 'dbpass',
                            'DB_PREFIX' => 'tblpfx',
                        ];

                        if (isset($key_map[$name])) {
                            $config[$key_map[$name]] = $value;
                        }
                        $_ENV[$name] = $value;
                    }
                }
            }

            // 2. Read config.ini.php
            if (file_exists(Webtrees::CONFIG_FILE)) {
                $ini_config = parse_ini_file(Webtrees::CONFIG_FILE) ?: [];
                $config = array_merge($config, $ini_config);
            }

            DB::connect(
                driver: $config['dbtype'] ?? DB::MYSQL,
                host: $config['dbhost'] ?? '',
                port: $config['dbport'] ?? '',
                database: $config['dbname'] ?? '',
                username: $config['dbuser'] ?? '',
                password: $config['dbpass'] ?? '',
                prefix: $config['tblpfx'] ?? '',
                key: $config['dbkey'] ?? '',
                certificate: $config['dbcert'] ?? '',
                ca: $config['dbca'] ?? '',
                verify_certificate: (bool) ($config['dbverify'] ?? ''),
            );
        } catch (Throwable) {
            // Ignore errors
        }

        return $this;
    }
}
