<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\TreeService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

use function json_encode;
use function response;
use function usort;

use const JSON_THROW_ON_ERROR;

class ApiTimelineHandler implements RequestHandlerInterface
{
    public function __construct(
        private readonly TreeService $tree_service,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree_name = $request->getAttribute('tree');
        $xref = $request->getAttribute('xref');
        $tree = $this->tree_service->all()->get($tree_name);

        if (!$tree) {
            return Registry::responseFactory()->response(['success' => false, 'message' => 'Tree not found'], 404);
        }

        $individual = Registry::individualFactory()->make($xref, $tree);

        if (!$individual) {
            return Registry::responseFactory()->response(['success' => false, 'message' => 'Individual not found'], 404);
        }

        $events = [];

        // Personal facts
        foreach ($individual->facts() as $fact) {
            $date = $fact->date();
            if ($date->isOK()) {
                $events[] = [
                    'date' => $date->display(),
                    'sort_date' => $date->minimumJulianDay(),
                    'type' => $fact->label(),
                    'description' => $fact->value(),
                    'place' => $fact->place()->shortName(),
                    'fact_type' => $fact->tag(),
                ];
            }
        }

        // Family events (Marriage)
        foreach ($individual->spouseFamilies() as $family) {
            foreach ($family->facts(['MARR', 'DIV']) as $fact) {
                $date = $fact->date();
                if ($date->isOK()) {
                    $other_spouse = $family->spouse($individual);
                    $description = $other_spouse ? 'with ' . $other_spouse->fullName() : '';

                    $events[] = [
                        'date' => $date->display(),
                        'sort_date' => $date->minimumJulianDay(),
                        'type' => $fact->label(),
                        'description' => $description,
                        'place' => $fact->place()->shortName(),
                        'fact_type' => $fact->tag(),
                    ];
                }
            }

            // Children births
            foreach ($family->children() as $child) {
                $birth = $child->getBirthDate();
                if ($birth->isOK()) {
                    $events[] = [
                        'date' => $birth->display(),
                        'sort_date' => $birth->minimumJulianDay(),
                        'type' => 'Child Born',
                        'description' => $child->fullName(),
                        'place' => '',
                        'fact_type' => 'CHIL_BIRT',
                    ];
                }
            }
        }

        // Sort by date
        usort($events, fn($a, $b) => $a['sort_date'] <=> $b['sort_date']);

        return response(json_encode([
            'success' => true,
            'individual' => [
                'name' => $individual->fullName(),
                'xref' => $individual->xref(),
                'sex' => $individual->sex(),
            ],
            'events' => $events,
        ], JSON_THROW_ON_ERROR))
            ->withHeader('Content-Type', 'application/json');
    }
}
