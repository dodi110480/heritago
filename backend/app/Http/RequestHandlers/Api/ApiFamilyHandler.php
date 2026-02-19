<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\GedcomImportService;
use Fisharebest\Webtrees\Services\TreeService;
use Fisharebest\Webtrees\Tree;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function array_map;
use function explode;
use function implode;
use function is_array;
use function preg_match;
use function str_replace;
use function trim;

class ApiFamilyHandler implements RequestHandlerInterface
{
    private GedcomImportService $gedcom_import_service;

    public function __construct(
        private readonly TreeService $tree_service,
    ) {
        $this->gedcom_import_service = new GedcomImportService();
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree_attr = $request->getAttribute('tree');
        $tree = ($tree_attr instanceof Tree) ? $tree_attr : $this->tree_service->all()->get($tree_attr);

        if (!$tree) {
            return Registry::responseFactory()->response(['success' => false, 'message' => 'Tree not found'], 404);
        }

        $params = (array) $request->getParsedBody();
        $famId = $params['id'] ?? null;

        if (!$famId) {
            return Registry::responseFactory()->response(['success' => false, 'message' => 'Family ID required'], 400);
        }

        $id = trim($famId, '@');
        $xref = '@' . $id . '@';

        // Fetch existing family
        $fam = DB::table('families')->where('f_file', $tree->id())->where('f_id', $id)->first();
        if (!$fam) {
            return Registry::responseFactory()->response(['success' => false, 'message' => 'Family not found'], 404);
        }

        $existingGedcom = $fam->f_gedcom;

        // We want to keep structural tags (HUSB, WIFE, CHIL, etc.) but replace events
        $eventTags = ['ANUL', 'CENS', 'DIV', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS', 'EVEN'];

        $lines = explode("\n", str_replace("\r", "", $existingGedcom));
        $preservedLines = [];
        $skip = false;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || str_starts_with($line, '0 ')) {
                continue; // We'll re-add the 0 line
            }

            // Check if it's a level 1 event tag we want to replace
            $matchEvent = false;
            foreach ($eventTags as $tag) {
                if (str_starts_with($line, '1 ' . $tag)) {
                    $matchEvent = true;
                    break;
                }
            }

            if ($matchEvent) {
                $skip = true;
                continue;
            }

            // Check if we stop skipping (reached another level 1 tag)
            if ($skip && str_starts_with($line, '1 ')) {
                $skip = false;
            }

            if (!$skip) {
                $preservedLines[] = $line;
            }
        }

        // Build new GEDCOM
        $newGedcom = "0 $xref FAM\n";
        foreach ($preservedLines as $line) {
            $newGedcom .= $line . "\n";
        }

        // Add new events
        $events = $params['events'] ?? [];
        if (is_array($events)) {
            foreach ($events as $event) {
                $type = $event['type'] ?? 'EVEN';
                $date = $event['date'] ?? '';
                $place = $event['place'] ?? '';
                $desc = $event['description'] ?? '';

                $newGedcom .= "1 $type";
                if (!empty($desc)) {
                    $newGedcom .= " $desc";
                }
                $newGedcom .= "\n";

                if (!empty($date)) {
                    $newGedcom .= "2 DATE " . $this->formatGedcomDate($date) . "\n";
                }
                if (!empty($place)) {
                    $newGedcom .= "2 PLAC $place\n";
                }
            }
        }

        try {
            $this->gedcom_import_service->updateRecord($newGedcom, $tree, false);
            return Registry::responseFactory()->response(['success' => true], 200);
        } catch (\Throwable $e) {
            return Registry::responseFactory()->response(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    private function formatGedcomDate(string $date): string
    {
        if (empty($date)) {
            return '';
        }
        // Basic conversion for DD.MM.YYYY
        if (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', $date, $m)) {
            $months = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            return $m[1] . ' ' . $months[(int) $m[2]] . ' ' . $m[3];
        }
        return strtoupper($date);
    }
}
