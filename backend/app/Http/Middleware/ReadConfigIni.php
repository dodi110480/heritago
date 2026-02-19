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

namespace Fisharebest\Webtrees\Http\Middleware;

use Fisharebest\Webtrees\Http\RequestHandlers\SetupWizard;
use Fisharebest\Webtrees\Webtrees;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function file_exists;
use function parse_ini_file;

class ReadConfigIni implements MiddlewareInterface
{
    private SetupWizard $setup_wizard;

    /**
     * @param SetupWizard $setup_wizard
     */
    public function __construct(SetupWizard $setup_wizard)
    {
        $this->setup_wizard = $setup_wizard;
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $config = [];

        // 1. Read .env file if it exists
        $env_file = Webtrees::ROOT_DIR . '.env';
        if (file_exists($env_file)) {
            $lines = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }

                if (str_contains($line, '=')) {
                    [$name, $value] = explode('=', $line, 2);
                    $name = trim($name);
                    $value = trim($value, " \t\n\r\0\x0B\"'");

                    // Map .env keys to app attributes
                    $key_map = [
                        'DB_TYPE' => 'dbtype',
                        'DB_HOST' => 'dbhost',
                        'DB_PORT' => 'dbport',
                        'DB_NAME' => 'dbname',
                        'DB_USER' => 'dbuser',
                        'DB_PASS' => 'dbpass',
                        'DB_PREFIX' => 'tblpfx',
                        'BASE_URL' => 'base_url',
                        'REWRITE_URLS' => 'rewrite_urls',
                    ];

                    if (isset($key_map[$name])) {
                        $config[$key_map[$name]] = $value;
                    } else {
                        $config[strtolower($name)] = $value;
                    }

                    $_ENV[$name] = $value;
                }
            }
        }

        // 2. Read config.ini.php if it exists (can override .env or provide defaults)
        if (file_exists(Webtrees::CONFIG_FILE)) {
            $ini_config = parse_ini_file(Webtrees::CONFIG_FILE);
            $config = array_merge($config, $ini_config);
        }

        if (empty($config)) {
            // No configuration found? Run the setup wizard.
            $handler = $this->setup_wizard;
        } else {
            // Store the configuration settings as request attributes.
            foreach ($config as $key => $value) {
                $request = $request->withAttribute($key, $value);
            }
        }

        return $handler->handle($request);
    }
}
