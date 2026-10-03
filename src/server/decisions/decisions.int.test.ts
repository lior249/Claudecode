import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getLearnerProgression } from "@/server/learn/service";
import { resetDb, seedCourse } from "../../../tests/db";
import { chooseCatalogItem, DecisionError, getDecisionView } from "./service";
import { deleteCatalogItem, saveCatalogItem } from "./admin";
import { createCriterion, createOption, deleteCriterion, listCriteria } from "./criteria";
import { checkLaunchKey, getLaunchView, grantEliteRole, LaunchError, submitLaunch } from "@/server/launch/service";

async function niche(title: string, extra: object = {}) {
  return prisma.catalogItem.create({ data: { catalog: "NICHE", title, ...extra } });
}

const blank = { summary: "", body: "", thumbnailKey: null, imageKeys: [], links: [], isPublished: true };

describe("Décisions (catalogues)", () => {
  beforeEach(resetDb);

  it("l'élève voit les fiches publiées, en choisit une seule, la leçon est validée", async () => {
    const { lessons, learner } = await seedCourse(["DECISION", "DECISION"]);
    await prisma.lesson.update({ where: { id: lessons[0].id }, data: { config: { catalog: "niches" } } });
    const comp = await createCriterion(learner.id, "NICHE", "Concurrence");
    const low = await createOption(learner.id, comp.id, { label: "Faible", color: "green" });
    const a = await saveCatalogItem(learner.id, { id: null, catalog: "NICHE", title: "Aviation", optionIds: [low.id], ...blank });
    await niche("Cachée", { isPublished: false });
    const view = await getDecisionView(learner.id, lessons[0].id);
    expect(view.items.map((i) => i.title)).toEqual(["Aviation"]);
    expect(view.items[0].tags).toEqual([{ criterion: "Concurrence", label: "Faible", color: "green" }]);

    await chooseCatalogItem(learner.id, lessons[0].id, a.id);
    expect((await getDecisionView(learner.id, lessons[0].id)).chosen?.title).toBe("Aviation");
    expect((await getLearnerProgression(learner.id)).progression.currentLessonId).toBe(lessons[1].id);
    await expect(chooseCatalogItem(learner.id, lessons[0].id, a.id)).rejects.toThrow(DecisionError);
  });

  it("refuse une fiche masquée, d'un autre catalogue, ou une leçon verrouillée", async () => {
    const { lessons, learner } = await seedCourse(["DECISION", "DECISION"]);
    for (const l of lessons) await prisma.lesson.update({ where: { id: l.id }, data: { config: { catalog: "niches" } } });
    const hidden = await niche("Cachée", { isPublished: false });
    const country = await prisma.catalogItem.create({ data: { catalog: "COUNTRY", title: "France" } });
    const ok = await niche("Ok");
    await expect(chooseCatalogItem(learner.id, lessons[0].id, hidden.id)).rejects.toThrow("plus disponible");
    await expect(chooseCatalogItem(learner.id, lessons[0].id, country.id)).rejects.toThrow("plus disponible");
    await expect(chooseCatalogItem(learner.id, lessons[1].id, ok.id)).rejects.toThrow("pas encore disponible");
  });

  it("une fiche déjà choisie ne peut pas être supprimée ; le titre choisi reste même si la fiche change", async () => {
    const { lessons, learner } = await seedCourse(["DECISION"]);
    await prisma.lesson.update({ where: { id: lessons[0].id }, data: { config: { catalog: "niches" } } });
    const a = await niche("Aviation");
    await chooseCatalogItem(learner.id, lessons[0].id, a.id);
    expect((await deleteCatalogItem(learner.id, a.id)).ok).toBe(false);
    await prisma.catalogItem.update({ where: { id: a.id }, data: { title: "Aviation (v2)" } });
    expect((await getDecisionView(learner.id, lessons[0].id)).chosen?.title).toBe("Aviation");
  });
});

describe("Lancement (phrase + code + ressenti)", () => {
  beforeEach(resetDb);
  const CONFIG = { phrase: "J'ai validé le module à 100 %", code: "ABCDEFGH23", questions: ["Q1 ?", "Q2 ?"] };
  const long = "Une réponse suffisamment développée pour passer.";

  it("ne révèle jamais la phrase ni le code ; refuse un mauvais code", async () => {
    const { lessons, learner } = await seedCourse(["CODE_VALIDATION"]);
    await prisma.lesson.update({ where: { id: lessons[0].id }, data: { config: CONFIG } });
    const view = await getLaunchView(learner.id, lessons[0].id);
    expect(JSON.stringify(view)).not.toContain("ABCDEFGH23");
    expect(JSON.stringify(view)).not.toContain("100 %");
    await expect(checkLaunchKey(learner.id, lessons[0].id, CONFIG.phrase, "FAUX")).rejects.toThrow(LaunchError);
    await checkLaunchKey(learner.id, lessons[0].id, CONFIG.phrase, "abcd efgh 23");
  });

  it("bloque après 10 mauvais essais en une heure", async () => {
    const { lessons, learner } = await seedCourse(["CODE_VALIDATION"]);
    await prisma.lesson.update({ where: { id: lessons[0].id }, data: { config: CONFIG } });
    for (let i = 0; i < 10; i++) await checkLaunchKey(learner.id, lessons[0].id, "x", "y").catch(() => undefined);
    await expect(checkLaunchKey(learner.id, lessons[0].id, CONFIG.phrase, CONFIG.code)).rejects.toThrow("Trop d'essais");
  });

  it("réponses trop courtes refusées ; envoi complet = Learn terminé + tâche rôle @Élite", async () => {
    const { lessons, learner } = await seedCourse(["CODE_VALIDATION"]);
    await prisma.lesson.update({ where: { id: lessons[0].id }, data: { config: CONFIG } });
    await expect(submitLaunch(learner.id, lessons[0].id, { phrase: CONFIG.phrase, code: CONFIG.code, answers: [long, "court"] })).rejects.toThrow("Question 2");
    await submitLaunch(learner.id, lessons[0].id, { phrase: CONFIG.phrase, code: CONFIG.code, answers: [long, long] });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: learner.id } });
    expect(user.learnCompletedAt).not.toBeNull();
    expect((await getLearnerProgression(learner.id)).progression.learnCompleted).toBe(true);
    expect(await prisma.job.count({ where: { type: "discord.grantElite" } })).toBe(1);
    const report = await prisma.launchReport.findFirstOrThrow();
    expect(report.answers).toEqual([{ question: "Q1 ?", answer: long }, { question: "Q2 ?", answer: long }]);
    await expect(submitLaunch(learner.id, lessons[0].id, { phrase: CONFIG.phrase, code: CONFIG.code, answers: [long, long] })).rejects.toThrow();

    // Sans bot Discord configuré (tests) : la tâche ne plante pas et n'invente pas d'attribution.
    await grantEliteRole(learner.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).eliteGrantedAt).toBeNull();
  });

  it("critères libres : une option par critère, seulement celles du catalogue, supprimées avec leur critère", async () => {
    const { learner: admin } = await seedCourse(["DECISION"]);
    const comp = await createCriterion(admin.id, "NICHE", "Concurrence");
    const low = await createOption(admin.id, comp.id, { label: "Faible", color: "green" });
    const high = await createOption(admin.id, comp.id, { label: "Forte", color: "red" });
    const budget = await createCriterion(admin.id, "NICHE", "Budget");
    const zero = await createOption(admin.id, budget.id, { label: "0 €", color: "gray" });
    const lang = await createCriterion(admin.id, "COUNTRY", "Langue");
    const fr = await createOption(admin.id, lang.id, { label: "Français", color: "blue" });

    const item = await saveCatalogItem(admin.id, { id: null, catalog: "NICHE", title: "Cuisine", optionIds: [low.id, high.id, zero.id, fr.id], ...blank });
    const saved = await prisma.catalogItemOption.findMany({ where: { itemId: item.id } });
    expect(saved.map((o) => o.optionId).sort()).toEqual([low.id, zero.id].sort());

    expect((await listCriteria("NICHE")).map((c) => [c.label, c.options.map((o) => `${o.label}:${o.used}`)])).toEqual([
      ["Concurrence", ["Faible:1", "Forte:0"]],
      ["Budget", ["0 €:1"]],
    ]);
    await deleteCriterion(admin.id, comp.id);
    expect(await prisma.catalogItemOption.count({ where: { itemId: item.id } })).toBe(1);
  });
});
