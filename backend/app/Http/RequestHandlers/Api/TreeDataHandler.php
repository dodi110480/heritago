<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\TreeService;

use function json_encode;
use function response;

use const JSON_THROW_ON_ERROR;

/**
 * API handler to return all tree data (individuals and families) as JSON.
 */
class TreeDataHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly TreeService $tree_service,
    ) {
    }

    /**
     * Handle the request and return the tree data as JSON.
     *
     * @param ServerRequestInterface $request
     *
     * @return ResponseInterface
     */
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree_name = $request->getAttribute('tree');

        if ($tree_name instanceof \Fisharebest\Webtrees\Tree) {
            $tree = $tree_name;
        } else {
            $tree = $this->tree_service->all()->get($tree_name);
        }

        if (!$tree) {
            return Registry::responseFactory()->response([
                'success' => false,
                'message' => 'Tree not found',
            ], 404);
        }

        $individuals = DB::table('individuals')
            ->where('i_file', '=', $tree->id())
            ->get();

        // Pre-fetch families to build relationship maps
        $allFamilies = DB::table('families')
            ->where('f_file', '=', $tree->id())
            ->get();

        $individualParents = [];
        $individualSpouses = [];

        foreach ($allFamilies as $famRow) {
            $f_gedcom = $famRow->f_gedcom;
            $husband = '';
            if (preg_match('/(?:^|[\r\n])1 HUSB @(.*)@/', $f_gedcom, $match)) {
                $husband = $match[1];
            }
            $wife = '';
            if (preg_match('/(?:^|[\r\n])1 WIFE @(.*)@/', $f_gedcom, $match)) {
                $wife = $match[1];
            }
            $children = [];
            if (preg_match_all('/(?:^|[\r\n])1 CHIL @(.*)@/', $f_gedcom, $matches)) {
                $children = $matches[1];
            }

            foreach ($children as $childId) {
                if (!isset($individualParents[$childId])) {
                    $individualParents[$childId] = [];
                }
                $individualParents[$childId][] = $famRow->f_id;
            }

            if ($husband) {
                if (!isset($individualSpouses[$husband])) {
                    $individualSpouses[$husband] = [];
                }
                $individualSpouses[$husband][] = $famRow->f_id;
            }
            if ($wife) {
                if (!isset($individualSpouses[$wife])) {
                    $individualSpouses[$wife] = [];
                }
                $individualSpouses[$wife][] = $famRow->f_id;
            }
        }

        $individuals = $individuals->map(function ($row) use ($tree, $individualParents, $individualSpouses) {
            $gedcom = $row->i_gedcom;

            // Basic extraction using regex
            $name = '';
            $gedcomName = '';
            if (preg_match('/(?:^|[\r\n])1 NAME (.*)/', $gedcom, $match)) {
                $gedcomName = trim($match[1]);
                $name = trim(str_replace('/', '', $match[1]));
            } else {
                $name = 'Unbekannte Person (' . $row->i_id . ')';
            }

            $title = '';
            if (preg_match('/(?:^|[\r\n])1 TITL (.*)/', $gedcom, $match)) {
                $title = trim($match[1]);
            }

            $gender = 'U';
            if (preg_match('/(?:^|[\r\n])1 SEX ([MFXU])/', $gedcom, $match)) {
                $gender = $match[1];
            }

            // Dates and Places
            $birthDate = '';
            $birthPlace = '';
            if (preg_match('/(?:^|[\r\n])1 BIRT[\r\n\s\S]*?2 DATE (.*)/m', $gedcom, $match)) {
                $birthDate = trim($match[1]);
            }
            if (preg_match('/(?:^|[\r\n])1 BIRT[\r\n\s\S]*?2 PLAC (.*)/m', $gedcom, $match)) {
                $birthPlace = trim($match[1]);
            }

            $deathDate = '';
            $deathPlace = '';
            if (preg_match('/(?:^|[\r\n])1 DEAT[\r\n\s\S]*?2 DATE (.*)/m', $gedcom, $match)) {
                $deathDate = trim($match[1]);
            }
            if (preg_match('/(?:^|[\r\n])1 DEAT[\r\n\s\S]*?2 PLAC (.*)/m', $gedcom, $match)) {
                $deathPlace = trim($match[1]);
            }

            $email = '';
            if (preg_match('/(?:^|[\r\n])1 RESI[\r\n\s\S]*?2 EMAIL (.*)/m', $gedcom, $match)) {
                $email = trim($match[1]);
            }

            $suffix = '';
            if (preg_match('/(?:^|[\r\n])2 NSFX (.*)/', $gedcom, $match)) {
                $suffix = trim($match[1]);
            }

            $birthName = '';
            if (preg_match_all('/(?:^|[\r\n])1 NAME (.*)[\r\n]2 TYPE BIRTH/m', $gedcom, $matches)) {
                $bnMatch = end($matches[1]);
                $birthName = trim(str_replace('/', '', $bnMatch));
            }

            // Extract generic Life Events
            $events = [];
            // List of tags to extract
            $eventTags = 'ADOP|BAPM|BARM|BASM|BIRT|BLES|BURI|CENS|CHR|CHRA|CONF|CREM|DEAT|EMIG|FCOM|GRAD|IMMI|NATU|ORDN|RETI|PROB|WILL|MARR|DIV|CAST|DSCR|EDUC|IDNO|NATI|NCHI|NMR|OCCU|PROP|RELI|RESI|TITL|SSN|EVEN|FACT';

            if (preg_match_all('/(?:^|[\r\n])1 (' . $eventTags . ')(.*)([\r\n\s\S]*?)(?=(?:^|[\r\n])1 |$)/m', $gedcom, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $match) {
                    $type = $match[1];
                    $inlineValue = trim($match[2]);
                    $details = $match[3];

                    $date = '';
                    if (preg_match('/(?:^|[\r\n])2 DATE (.*)/', $details, $dMatch)) {
                        $date = trim($dMatch[1]);
                    }

                    $place = '';
                    if (preg_match('/(?:^|[\r\n])2 PLAC (.*)/', $details, $pMatch)) {
                        $place = trim($pMatch[1]);
                    }

                    $desc = $inlineValue;
                    if (empty($desc)) {
                        // Or try TYPE if inline is empty (common for EVEN)
                        if (preg_match('/(?:^|[\r\n])2 TYPE (.*)/', $details, $tMatch)) {
                            $desc = trim($tMatch[1]);
                        }
                    }

                    // For OCCU/EDUC, the description is often the inline value
                    // For RESI, usually place is key

                    $events[] = [
                        'type' => $type,
                        'date' => $date,
                        'place' => $place,
                        'description' => $desc
                    ];
                }
            }

            return [
                'id' => $row->i_id,
                'name' => $name,
                'firstName' => explode(' /', $gedcomName)[0] ?? $name,
                'lastName' => (str_contains($gedcomName, '/')) ? explode('/', $gedcomName)[1] : '',
                'gedcomName' => $gedcomName,
                'birthDate' => $birthDate,
                'birthPlace' => $birthPlace,
                'deathDate' => $deathDate,
                'deathPlace' => $deathPlace,
                'gender' => $gender,
                'title' => $title,
                'suffix' => $suffix,
                'birthName' => $birthName,
                'email' => $email,
                'isAlive' => empty($deathDate) && empty($deathPlace) && !str_contains($gedcom, '1 DEAT'),
                'parents' => $individualParents[$row->i_id] ?? [],
                'spouses' => $individualSpouses[$row->i_id] ?? [],
                'events' => $events
            ];
        });

        $families = DB::table('families')
            ->where('f_file', '=', $tree->id())
            ->get()
            ->map(function ($row) {
                $husband = '';
                if (preg_match('/(?:^|[\r\n])1 HUSB @(.*)@/', $row->f_gedcom, $match)) {
                    $husband = $match[1];
                }

                $wife = '';
                if (preg_match('/(?:^|[\r\n])1 WIFE @(.*)@/', $row->f_gedcom, $match)) {
                    $wife = $match[1];
                }

                $children = [];
                if (preg_match_all('/(?:^|[\r\n])1 CHIL @(.*)@/', $row->f_gedcom, $matches)) {
                    $children = $matches[1];
                }

                $events = [];
                $eventTags = 'ANUL|CENS|DIV|DIVF|ENGA|MARB|MARC|MARL|MARR|MARS|EVEN';
                if (preg_match_all('/(?:^|[\r\n])1 (' . $eventTags . ')(.*)([\r\n\s\S]*?)(?=(?:^|[\r\n])1 |$)/m', $row->f_gedcom, $matches, PREG_SET_ORDER)) {
                    foreach ($matches as $match) {
                        $type = $match[1];
                        $inlineValue = trim($match[2]);
                        $details = $match[3];

                        $date = '';
                        if (preg_match('/(?:^|[\r\n])2 DATE (.*)/', $details, $dMatch)) {
                            $date = trim($dMatch[1]);
                        }
                        $place = '';
                        if (preg_match('/(?:^|[\r\n])2 PLAC (.*)/', $details, $pMatch)) {
                            $place = trim($pMatch[1]);
                        }
                        $desc = $inlineValue;
                        if (empty($desc) && preg_match('/(?:^|[\r\n])2 TYPE (.*)/', $details, $tMatch)) {
                            $desc = trim($tMatch[1]);
                        }

                        $events[] = [
                            'type' => $type,
                            'date' => $date,
                            'place' => $place,
                            'description' => $desc
                        ];
                    }
                }

                return [
                    'id' => $row->f_id,
                    'husband' => $husband,
                    'wife' => $wife,
                    'children' => $children,
                    'events' => $events,
                ];
            });

        $data = [
            'meta' => [
                'tree' => $tree->name(),
                'title' => $tree->title(),
                'id' => $tree->id()
            ],
            'individuals' => $individuals->all(),
            'families' => $families->all(),
        ];

        return response(json_encode($data, JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->withHeader('Pragma', 'no-cache');
    }
}
