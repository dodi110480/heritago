<?php

declare(strict_types=1);

namespace Fisharebest\Webtrees\Http\RequestHandlers\Api;

use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\GedcomImportService;
use Fisharebest\Webtrees\Services\TreeService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Fisharebest\Webtrees\Tree;

class ApiPersonHandler implements RequestHandlerInterface
{
    private GedcomImportService $gedcom_import_service;

    public function __construct(
        private readonly TreeService $tree_service,
    ) {
        // Manual instantiation to bypass DI container issues
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
        $mode = $params['mode'] ?? 'add';

        // Basic fields
        $firstName = $params['firstName'] ?? '';
        $lastName = $params['lastName'] ?? '';
        $birthName = $params['birthName'] ?? '';
        $title = $params['title'] ?? '';
        $suffix = $params['suffix'] ?? '';
        $gender = $params['gender'] ?? 'U';
        $birthDate = $params['birthDate'] ?? '';
        $birthPlace = $params['birthPlace'] ?? '';
        $isAlive = $params['isAlive'] ?? true;
        $deathDate = $params['deathDate'] ?? '';
        $deathPlace = $params['deathPlace'] ?? '';
        $email = $params['email'] ?? '';

        // Normalize Name
        $gedcomName = "$firstName /$lastName/";

        // ID Management
        $fatherId = !empty($params['fatherId']) ? $params['fatherId'] : null;
        $motherId = !empty($params['motherId']) ? $params['motherId'] : null;
        $spouseId = !empty($params['spouseId']) ? $params['spouseId'] : null;

        $xref = '';
        if ($mode === 'add') {
            $nextXref = $this->tree_service->nextXref($tree, 'INDI');
            $xref = '@' . $nextXref . '@';
        } elseif ($mode === 'delete') {
            $id = $params['id'] ?? null;
            if (!$id) {
                return Registry::responseFactory()->response(['success' => false, 'message' => 'ID required'], 400);
            }
            $xref = '@' . $id . '@';
            $indi = "0 $xref INDI\n";
            try {
                $this->gedcom_import_service->updateRecord($indi, $tree, true); // true = delete
                return Registry::responseFactory()->response(['success' => true], 200);
            } catch (\Throwable $e) {
                return Registry::responseFactory()->response(['success' => false, 'message' => $e->getMessage()], 500);
            }
        } else { // edit
            $id = $params['id'] ?? null;
            if (!$id)
                return Registry::responseFactory()->response(['success' => false, 'message' => 'ID required'], 400);
            $xref = '@' . $id . '@';
        }

        // Construct GEDCOM Record
        // In edit mode, we extract existing links
        $preservedLinks = [];
        if ($mode === 'edit') {
            $existingRecord = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', trim($xref, '@'))->value('i_gedcom');
            if ($existingRecord) {
                // Extract FAMS / FAMC lines
                preg_match_all('/^1 (FAM[SC]) @(.+)@/m', $existingRecord, $matches);
                foreach ($matches[1] as $index => $tag) {
                    // Critical: If we are SETTING parents, don't preserve old FAMC links
                    // This avoids the preserved link being written back before linkParents() can change it.
                    if ($tag === 'FAMC' && ($fatherId || $motherId)) {
                        continue;
                    }
                    $preservedLinks[] = ['tag' => $tag, 'xref' => '@' . $matches[2][$index] . '@'];
                }
            }
        }

        // Debug Payload to file
        file_put_contents(__DIR__ . '/../../../../debug_payload.txt', date('Y-m-d H:i:s') . " - SavePerson: " . print_r($params, true) . PHP_EOL, FILE_APPEND);

        if ($mode === 'edit' && ($fatherId || $motherId)) {

            $hasMatchingFam = false;
            foreach ($preservedLinks as $key => $link) {
                if ($link['tag'] === 'FAMC') {
                    $famId = trim($link['xref'], '@');
                    $fam = \Fisharebest\Webtrees\DB::table('families')->where('f_file', $tree->id())->where('f_id', $famId)->first();
                    if ($fam) {
                        // If it matches new parents, keep it. If not, we'll remove it and add new one.
                        if (($fatherId === null || $fam->f_husb === $fatherId) && ($motherId === null || $fam->f_wife === $motherId)) {
                            $hasMatchingFam = true;
                        } else {
                            unset($preservedLinks[$key]);
                        }
                    }
                }
            }
        }

        $indi = "0 $xref INDI\n";
        $indi .= "1 NAME $gedcomName\n";
        $indi .= "2 GIVN $firstName\n";
        $indi .= "2 SURN $lastName\n";
        if ($suffix) {
            $indi .= "2 NSFX $suffix\n";
        }

        if ($birthName && $birthName !== $lastName) {
            $indi .= "1 NAME $firstName /$birthName/\n";
            $indi .= "2 TYPE BIRTH\n";
            $indi .= "2 GIVN $firstName\n";
            $indi .= "2 SURN $birthName\n";
        }

        if ($title) {
            $indi .= "1 TITL $title\n";
        }

        $indi .= "1 SEX $gender\n";

        if ($birthDate || $birthPlace) {
            $indi .= "1 BIRT Y\n";
            if ($birthDate) {
                $indi .= "2 DATE " . $this->formatGedcomDate($birthDate) . "\n";
            }
            if ($birthPlace)
                $indi .= "2 PLAC $birthPlace\n";
        }

        // Email and Residence
        // In GEDCOM 7, EMAIL belongs to EVENT_DETAIL - common way is under RESI attribute
        if ($email) {
            $indi .= "1 RESI\n";
            $indi .= "2 EMAIL $email\n";
        }

        // Death logic
        $isDead = ($isAlive === false || $isAlive === 'false' || $deathDate || $deathPlace);

        if ($isDead) {
            $indi .= "1 DEAT Y\n";
            if ($deathDate) {
                $indi .= "2 DATE " . $this->formatGedcomDate($deathDate) . "\n";
            }
            if ($deathPlace)
                $indi .= "2 PLAC $deathPlace\n";
        }

        // Events
        $events = $params['events'] ?? [];
        if (is_array($events)) {
            $attributes = ['OCCU', 'EDUC', 'RESI', 'FACT', 'DSCR', 'RELI', 'CAST', 'IDNO', 'NATI', 'NCHI', 'NMR', 'PROP', 'TITL', 'SSN'];
            foreach ($events as $event) {
                $type = $event['type'] ?? 'EVEN';
                $date = $event['date'] ?? '';
                $place = $event['place'] ?? '';
                $desc = $event['description'] ?? '';

                if ($type === 'EVEN') {
                    $indi .= "1 EVEN $desc\n";
                } elseif (in_array($type, $attributes)) {
                    $indi .= "1 $type $desc\n";
                } else {
                    $indi .= "1 $type\n";
                    if ($desc)
                        $indi .= "2 TYPE $desc\n";
                }

                if ($date)
                    $indi .= "2 DATE " . $this->formatGedcomDate($date) . "\n";
                if ($place)
                    $indi .= "2 PLAC $place\n";
            }
        }

        // Add preserved links back
        foreach ($preservedLinks as $link) {
            $indi .= "1 {$link['tag']} {$link['xref']}\n";
        }

        try {
            // Use updateRecord for both add (safe even if missing) and edit (required).
            // Pass false for delete -> delete then re-add.
            $this->gedcom_import_service->updateRecord($indi, $tree, false);

            if ($mode === 'add' || $mode === 'edit') {
                $targetId = $params['targetId'] ?? null;
                $relationType = $params['relationType'] ?? null;

                // Priority 1: Explicit Parent Links (call always in edit mode to support removals)
                if ($mode === 'edit' || $fatherId || $motherId) {
                    $this->linkParents($tree, $xref, $fatherId, $motherId);
                }
                // Priority 2: Relative Target Link (only for new persons)
                elseif ($mode === 'add' && $targetId && $relationType && !($relationType === 'son' || $relationType === 'daughter')) {
                    $this->linkIndividual($tree, $xref, $targetId, $relationType);
                }
                // Fallback for child if parents not explicitly set but target is parent
                elseif ($mode === 'add' && $targetId && ($relationType === 'son' || $relationType === 'daughter')) {
                    $this->linkIndividual($tree, $xref, $targetId, $relationType);
                }

                // Handle explicit spouse link
                if ($spouseId) {
                    $this->linkSpouse($tree, $xref, $spouseId);
                }

                return Registry::responseFactory()->response(['success' => true, 'id' => trim($xref, '@')], 200);
            }

            return Registry::responseFactory()->response(['success' => true], 200);

        } catch (\Throwable $e) {
            return Registry::responseFactory()->response(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    private function linkIndividual(Tree $tree, string $childXref, string $targetId, string $type)
    {
        $targetXref = '@' . $targetId . '@';

        if ($type === 'son' || $type === 'daughter') {
            // Parent -> Family
            $famXref = null;

            // Check if parent has a family where they are a spouse
            $gender = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $targetId)->value('i_sex');
            $col = ($gender === 'M') ? 'f_husb' : 'f_wife';

            $existingFam = \Fisharebest\Webtrees\DB::table('families')
                ->where('f_file', $tree->id())
                ->where($col, $targetId)
                ->first();

            if ($existingFam) {
                $famXref = '@' . $existingFam->f_id . '@';
                $famGedcom = $existingFam->f_gedcom;
                if (!str_contains($famGedcom, "1 CHIL $childXref")) {
                    $famGedcom = rtrim($famGedcom) . "\n1 CHIL $childXref\n";
                    $this->gedcom_import_service->updateRecord($famGedcom, $tree, false);
                }
            } else {
                $famXrefId = $this->tree_service->nextXref($tree, 'FAM');
                $famXref = '@' . $famXrefId . '@';
                $famGedcom = "0 $famXref FAM\n";
                if ($gender === 'M') {
                    $famGedcom .= "1 HUSB $targetXref\n";
                } else {
                    $famGedcom .= "1 WIFE $targetXref\n";
                }
                $famGedcom .= "1 CHIL $childXref\n";
                $this->gedcom_import_service->updateRecord($famGedcom, $tree, false);
            }

            // Update Child Record to include FAMC
            $childRecord = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', trim($childXref, '@'))->value('i_gedcom');
            if ($childRecord && !str_contains($childRecord, "1 FAMC $famXref")) {
                $childRecord = rtrim($childRecord) . "\n1 FAMC $famXref\n";
                $this->gedcom_import_service->updateRecord($childRecord, $tree, false);
            }

        } else if ($type === 'partner') {
            $famXrefId = $this->tree_service->nextXref($tree, 'FAM');
            $famXref = '@' . $famXrefId . '@';
            $famGedcom = "0 $famXref FAM\n";

            $gender = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $targetId)->value('i_sex');
            if ($gender === 'M') {
                $famGedcom .= "1 HUSB $targetXref\n";
                $famGedcom .= "1 WIFE $childXref\n";
            } else {
                $famGedcom .= "1 WIFE $targetXref\n";
                $famGedcom .= "1 HUSB $childXref\n";
            }
            $this->gedcom_import_service->updateRecord($famGedcom, $tree, false);

            // Update both partners with FAMS
            // Target
            $targetRecord = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $targetId)->value('i_gedcom');
            if ($targetRecord && !str_contains($targetRecord, "1 FAMS $famXref")) {
                $targetRecord = rtrim($targetRecord) . "\n1 FAMS $famXref\n";
                $this->gedcom_import_service->updateRecord($targetRecord, $tree, false);
            }
            // New Partner/Child
            $childRecord = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', trim($childXref, '@'))->value('i_gedcom');
            if ($childRecord && !str_contains($childRecord, "1 FAMS $famXref")) {
                $childRecord = rtrim($childRecord) . "\n1 FAMS $famXref\n";
                $this->gedcom_import_service->updateRecord($childRecord, $tree, false);
            }
        } else if ($type === 'brother' || $type === 'sister') {
            // Sibling logic: Find target's FAMC. If none, create one.
            $targetRecord = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $targetId)->value('i_gedcom');

            $famXref = null;
            if (preg_match('/1 FAMC @(.*)@/', $targetRecord, $match)) {
                $famXref = '@' . $match[1] . '@';
            }

            if ($famXref) {
                // Add to existing family
                $existingFamId = trim($famXref, '@');
                $existingFam = \Fisharebest\Webtrees\DB::table('families')
                    ->where('f_file', $tree->id())
                    ->where('f_id', $existingFamId)
                    ->first();

                // Better way to find family by ID
                $famId = trim($famXref, '@');
                $existingFam = \Fisharebest\Webtrees\DB::table('families')
                    ->where('f_file', $tree->id())
                    ->where('f_id', $famId)
                    ->first();

                if ($existingFam) {
                    $famGedcom = $existingFam->f_gedcom;
                    if (!str_contains($famGedcom, "1 CHIL $childXref")) {
                        $famGedcom = rtrim($famGedcom) . "\n1 CHIL $childXref\n";
                        $this->gedcom_import_service->updateRecord($famGedcom, $tree, false);
                    }
                }
            } else {
                // No parents found. Create a new "dummy" family for siblings.
                $famXrefId = $this->tree_service->nextXref($tree, 'FAM');
                $famXref = '@' . $famXrefId . '@';
                $famGedcom = "0 $famXref FAM\n";
                // Add both as children
                $famGedcom .= "1 CHIL $targetXref\n";
                $famGedcom .= "1 CHIL $childXref\n";
                $this->gedcom_import_service->updateRecord($famGedcom, $tree, false);

                // Update target to have this FAMC
                if (!str_contains($targetRecord, "1 FAMC $famXref")) {
                    $targetRecord = rtrim($targetRecord) . "\n1 FAMC $famXref\n";
                    $this->gedcom_import_service->updateRecord($targetRecord, $tree, false);
                }
            }

            // Update new child to have this FAMC
            $childRecord = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', trim($childXref, '@'))->value('i_gedcom');
            if ($childRecord && !str_contains($childRecord, "1 FAMC $famXref")) {
                $childRecord = rtrim($childRecord) . "\n1 FAMC $famXref\n";
                $this->gedcom_import_service->updateRecord($childRecord, $tree, false);
            }
        }
    }

    private function linkParents(Tree $tree, string $childXref, ?string $fatherId, ?string $motherId)
    {
        $childId = trim($childXref, '@');
        $childRecord = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $childId)->value('i_gedcom');

        // 0. Remove existing FAMC links from child to ensure we don't have multiple
        if ($childRecord) {
            preg_match_all('/1 FAMC @(.*)@/', $childRecord, $matches);
            foreach ($matches[1] as $oldFamId) {
                $this->removeChildFromFamily($tree, $oldFamId, $childXref);
            }
            $newChildRecord = preg_replace('/(?:^|[\r\n])1 FAMC @.*@(?:\r?\n|$)/', "\n", $childRecord);
            if (trim($newChildRecord) !== trim($childRecord)) {
                $this->gedcom_import_service->updateRecord(trim($newChildRecord) . "\n", $tree, false);
                $childRecord = trim($newChildRecord) . "\n";
            }
        }

        // 1. Find if there is already a family with EXACTLY these parents
        $query = \Fisharebest\Webtrees\DB::table('families')->where('f_file', $tree->id());

        if ($fatherId && $motherId) {
            $query->where('f_husb', $fatherId)->where('f_wife', $motherId);
        } elseif ($fatherId) {
            $query->where('f_husb', $fatherId)->where(fn($q) => $q->whereNull('f_wife')->orWhere('f_wife', ''));
        } elseif ($motherId) {
            $query->where('f_wife', $motherId)->where(fn($q) => $q->whereNull('f_husb')->orWhere('f_husb', ''));
        } else {
            return; // No parents to link
        }

        $existingFam = $query->first();
        $famXref = null;

        if ($existingFam) {
            $famXref = '@' . $existingFam->f_id . '@';
            $famGedcom = $existingFam->f_gedcom;
            if (!str_contains($famGedcom, "1 CHIL $childXref")) {
                $famGedcom = rtrim($famGedcom) . "\n1 CHIL $childXref\n";
                $this->gedcom_import_service->updateRecord($famGedcom, $tree, false);
            }
        } else {
            // Create new family
            $famXrefId = $this->tree_service->nextXref($tree, 'FAM');
            $famXref = '@' . $famXrefId . '@';
            $famGedcom = "0 $famXref FAM\n";
            if ($fatherId)
                $famGedcom .= "1 HUSB @" . $fatherId . "@\n";
            if ($motherId)
                $famGedcom .= "1 WIFE @" . $motherId . "@\n";
            $famGedcom .= "1 CHIL $childXref\n";

            $this->gedcom_import_service->updateRecord($famGedcom, $tree, false);

            if ($fatherId) {
                $pRec = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $fatherId)->value('i_gedcom');
                if ($pRec && !str_contains($pRec, "1 FAMS $famXref")) {
                    $pRec = rtrim($pRec) . "\n1 FAMS $famXref\n";
                    $this->gedcom_import_service->updateRecord($pRec, $tree, false);
                }
            }
            if ($motherId) {
                $mRec = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $motherId)->value('i_gedcom');
                if ($mRec && !str_contains($mRec, "1 FAMS $famXref")) {
                    $mRec = rtrim($mRec) . "\n1 FAMS $famXref\n";
                    $this->gedcom_import_service->updateRecord($mRec, $tree, false);
                }
            }
        }

        // Link child to family (FAMC)
        // Refresh childRecord after potential earlier updates
        $childRecord = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $childId)->value('i_gedcom');
        if ($childRecord && !str_contains($childRecord, "1 FAMC $famXref")) {
            $childRecord = rtrim($childRecord) . "\n1 FAMC $famXref\n";
            $this->gedcom_import_service->updateRecord($childRecord, $tree, false);
        }
    }

    /**
     * Converts common date formats to GEDCOM 7 format: DD MON YYYY
     */
    private function formatGedcomDate(string $date): string
    {
        $date = trim($date);
        if (empty($date))
            return '';

        // Try to parse German/ISO dates
        $timestamp = strtotime($date);
        if ($timestamp === false) {
            // Check if it's already in DD.MM.YYYY
            if (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', $date, $matches)) {
                $timestamp = mktime(0, 0, 0, (int) $matches[2], (int) $matches[1], (int) $matches[3]);
            }
        }

        if ($timestamp !== false) {
            $day = date('j', $timestamp);
            $month = strtoupper(date('M', $timestamp)); // JAN, FEB, etc.
            $year = date('Y', $timestamp);
            return "$day $month $year";
        }

        // Return original capped if parsing fails (allow user manual entry like "ABT 1900")
        return strtoupper($date);
    }
    private function linkSpouse(Tree $tree, string $personXref, string $spouseId)
    {
        $spouseXref = '@' . $spouseId . '@';

        // 1. Check if they are already linked in a family
        $pGender = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', trim($personXref, '@'))->value('i_sex');
        $sGender = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $spouseId)->value('i_sex');

        // Determine roles. Default P=Husb S=Wife unless P is Female.
        $husb = null;
        $wife = null;

        if ($pGender === 'F' && $sGender !== 'F') {
            $wife = $personXref;
            $husb = $spouseXref;
        } elseif ($sGender === 'F' && $pGender !== 'F') {
            $wife = $spouseXref;
            $husb = $personXref;
        } else {
            // Default or Same Sex
            if ($pGender === 'M') {
                $husb = $personXref;
                $wife = $spouseXref;
            } else {
                $wife = $personXref;
                $husb = $spouseXref;
            }
        }

        // Check for existing family
        $query = \Fisharebest\Webtrees\DB::table('families')->where('f_file', $tree->id());
        if ($husb)
            $query->where('f_husb', trim($husb, '@'));
        if ($wife)
            $query->where('f_wife', trim($wife, '@'));

        $existingFam = $query->first();

        if ($existingFam) {
            // Already linked. Nothing to do.
            return;
        }

        // Create new Family
        $famXrefId = $this->tree_service->nextXref($tree, 'FAM');
        $famXref = '@' . $famXrefId . '@';
        $famGedcom = "0 $famXref FAM\n";
        if ($husb)
            $famGedcom .= "1 HUSB $husb\n";
        if ($wife)
            $famGedcom .= "1 WIFE $wife\n";

        $this->gedcom_import_service->updateRecord($famGedcom, $tree, false);

        // Update INDI records with FAMS
        if ($husb) {
            $hId = trim($husb, '@');
            $hRec = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $hId)->value('i_gedcom');
            if ($hRec && !str_contains($hRec, "1 FAMS $famXref")) {
                $hRec .= "\n1 FAMS $famXref";
                $this->gedcom_import_service->updateRecord($hRec, $tree, false);
            }
        }
        if ($wife) {
            $wId = trim($wife, '@');
            $wRec = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $wId)->value('i_gedcom');
            if ($wRec && !str_contains($wRec, "1 FAMS $famXref")) {
                $wRec .= "\n1 FAMS $famXref";
                $this->gedcom_import_service->updateRecord($wRec, $tree, false);
            }
        }
    }

    /**
     * Remove a child from a family's CHIL list.
     */
    private function removeChildFromFamily(Tree $tree, string $famId, string $childXref): void
    {
        $fam = \Fisharebest\Webtrees\DB::table('families')
            ->where('f_file', $tree->id())
            ->where('f_id', $famId)
            ->first();

        if ($fam) {
            $famGedcom = $fam->f_gedcom;
            // Remove `1 CHIL $childXref` line
            // Remove `1 CHIL $childXref` line robustly
            $newFamGedcom = preg_replace('/(?:^|[\r\n])1 CHIL ' . preg_quote($childXref, '/') . '(?:\r?\n|$)/', "\n", $famGedcom);

            if (trim($newFamGedcom) !== trim($famGedcom)) {
                // Check if the family is now "empty" (no more children and it was a single-parent family)
                $hasChildren = preg_match('/(?:^|[\r\n])1 CHIL @(.*)@/', $newFamGedcom);
                $hasHusband = preg_match('/(?:^|[\r\n])1 HUSB @(.*)@/', $newFamGedcom);
                $hasWife = preg_match('/(?:^|[\r\n])1 WIFE @(.*)@/', $newFamGedcom);

                if (!$hasChildren && (!$hasHusband || !$hasWife)) {
                    // Remove FAMS link from the remaining parent
                    $parentId = $hasHusband ? preg_replace('/.*1 HUSB @(.*)@.*/s', '$1', $newFamGedcom) :
                        ($hasWife ? preg_replace('/.*1 WIFE @(.*)@.*/s', '$1', $newFamGedcom) : null);

                    if ($parentId) {
                        $pRec = \Fisharebest\Webtrees\DB::table('individuals')->where('i_file', $tree->id())->where('i_id', $parentId)->value('i_gedcom');
                        if ($pRec) {
                            $newPRec = preg_replace('/(?:^|[\r\n])1 FAMS @' . preg_quote($famId, '/') . '@(?:\r?\n|$)/', "\n", $pRec);
                            if (trim($newPRec) !== trim($pRec)) {
                                $this->gedcom_import_service->updateRecord(trim($newPRec) . "\n", $tree, false);
                            }
                        }
                    }

                    // Delete the single-parent family record
                    $this->gedcom_import_service->updateRecord("0 @$famId@ FAM\n", $tree, true); // true = delete
                } else {
                    $this->gedcom_import_service->updateRecord(trim($newFamGedcom) . "\n", $tree, false);
                }
            }
        }
    }
}
