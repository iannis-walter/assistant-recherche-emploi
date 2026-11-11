import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

from tools import profil
from tools.profil import CHAMPS_OBLIGATOIRES, lire_entete, lire_profil, migrer, valider_entete

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "profil-test" / "profil.md"


class LectureTests(unittest.TestCase):
    def test_parses_scalars_lists_ints_null(self):
        entete = lire_entete(
            "---\n"
            "rayon_km: 35\n"
            "langues: [Français, Anglais]\n"
            "salaire_plancher_brut_annuel: null\n"
            'nom: "Camille Martin"\n'
            "vide: []\n"
            "---\nCorps\n"
        )
        self.assertEqual(entete["rayon_km"], 35)
        self.assertEqual(entete["langues"], ["Français", "Anglais"])
        self.assertIsNone(entete["salaire_plancher_brut_annuel"])
        self.assertEqual(entete["nom"], "Camille Martin")
        self.assertEqual(entete["vide"], [])

    def test_no_front_matter_raises_valueerror(self):
        with self.assertRaises(ValueError):
            lire_entete("# Profil sans en-tête\n")


class ValidationTests(unittest.TestCase):
    def test_fixture_profile_is_valid(self):
        self.assertEqual(valider_entete(lire_profil(FIXTURE)), [])

    def test_missing_required_fields_are_listed(self):
        messages = valider_entete({"nom": "Camille"})
        manquants = [c for c in CHAMPS_OBLIGATOIRES if c != "nom"]
        self.assertEqual(len(messages), len(manquants))
        for champ in manquants:
            self.assertTrue(any(champ in m for m in messages), champ)

    def test_empty_template_values_count_as_missing(self):
        entete = lire_profil(FIXTURE)
        entete["nom"] = ""
        entete["metiers_vises"] = []
        messages = valider_entete(entete)
        self.assertTrue(any("nom" in m for m in messages))
        self.assertTrue(any("metiers_vises" in m for m in messages))

    def test_null_salary_is_allowed(self):
        entete = lire_profil(FIXTURE)
        entete["salaire_plancher_brut_annuel"] = None
        self.assertEqual(valider_entete(entete), [])

    def test_rejects_bad_enums(self):
        entete = lire_profil(FIXTURE)
        entete["teletravail"] = "parfois"
        entete["cv_pages"] = 3
        messages = valider_entete(entete)
        self.assertTrue(any("teletravail" in m for m in messages))
        self.assertTrue(any("cv_pages" in m for m in messages))


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dossier = Path(self._tmp.name) / "profil"
        self.dossier.mkdir()
        self.chemin = self.dossier / "profil.md"
        self.chemin.write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")

    def tearDown(self):
        self._tmp.cleanup()

    def test_migrer_v1_is_noop_and_makes_no_backup(self):
        self.assertFalse(migrer(self.chemin))
        self.assertFalse((self.dossier / ".sauvegardes").exists())

    def test_migrer_backs_up_before_change(self):
        with mock.patch.object(profil, "VERSION_PROFIL", 2), mock.patch.dict(
            profil.ETAPES_MIGRATION, {1: lambda texte: texte}
        ):
            self.assertTrue(migrer(self.chemin))
        sauvegarde = self.dossier / ".sauvegardes" / date.today().isoformat() / "profil.md"
        self.assertTrue(sauvegarde.is_file())
        self.assertIn("version_profil: 1", sauvegarde.read_text(encoding="utf-8"))
        self.assertEqual(lire_profil(self.chemin)["version_profil"], 2)


class CorrectionsTests(unittest.TestCase):
    def test_phone_with_leading_zero_stays_text(self):
        entete = lire_entete("---\ntelephone: 0612345678\nrayon_km: 30\n---\n")
        self.assertEqual(entete["telephone"], "0612345678")
        self.assertEqual(entete["rayon_km"], 30)

    def test_template_requires_cv_pages_choice(self):
        template = Path(__file__).resolve().parent.parent / "templates" / "profil" / "profil.md"
        messages = valider_entete(lire_profil(template))
        self.assertTrue(any("cv_pages" in m for m in messages))


if __name__ == "__main__":
    unittest.main()
