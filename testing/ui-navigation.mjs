// Exercise real disclosure navigation after the task-first UI reorganisation.
// Never force a click, unhide a control or bypass a disabled action. Callers name
// the destination explicitly; the assertions still run against the real UI.
export async function reveal(page, selector) {
  const target = page.locator(selector);
  for (let n = 0; n < 5; n++) {
    const id = await target.evaluate(el => {
      let outer = null;
      for (let p = el.parentElement; p; p = p.parentElement)
        if (p.tagName === 'DETAILS' && !p.open && !p.firstElementChild?.contains(el)) outer = p;
      if (outer && !outer.id) throw new Error('Give this tested disclosure a stable ID');
      return outer?.id;
    });
    if (!id) return;
    await page.locator(`#${id} > summary`).click();
  }
  throw new Error(`Disclosure nesting exceeded for ${selector}`);
}

export async function openAccount(page) {
  await reveal(page, '#accountBtn');
  await page.locator('#accountBtn').click();
}
