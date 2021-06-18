(() => {
  let initialized = false;
  let summoningShardIds = [];
  let summoningShardShopCategory;
  let summoningShardShopIds;
  let showQuickShards = false;
  let buyQuantity = 1;
  let ignoreBank = false;
  let shardsToBuy = [];
  const observer = new MutationObserver(update);

  // Cached jQuery objects
  let $itemContainer;
  let $totalCostContainer;
  let $buyButton;

  function init () {
    if (initialized) return;

    if (!$('#summoning-creation-element').length) {
      setTimeout(() => init()), 50;
      return;
    }

    summoningShardIds = [
      CONSTANTS.item.Summoning_Shard_Black,
      CONSTANTS.item.Summoning_Shard_Blue,
      CONSTANTS.item.Summoning_Shard_Gold,
      CONSTANTS.item.Summoning_Shard_Green,
      CONSTANTS.item.Summoning_Shard_Red,
      CONSTANTS.item.Summoning_Shard_Silver
    ];
    summoningShardShopCategory = getSummoningShardShopCategory();
    summoningShardShopIds = getSummoningShardShopIds();

    loadPrefs();

    inject(buildBlock());

    observer.observe($('#summoning-item-have').get(0), { childList: true });

    initialized = true;
    console.log('QuickShards initialized');
  }

  function loadPrefs () {
    const prefs = JSON.parse(localStorage.getItem('bqs-prefs'));

    if (!prefs) return;

    if (prefs.buyQuantity !== undefined) buyQuantity = prefs.buyQuantity;
    if (prefs.showQuickShards !== undefined) showQuickShards = prefs.showQuickShards;
    if (prefs.ignoreBank !== undefined) ignoreBank = prefs.ignoreBank;
  }

  function savePrefs () {
    const prefs = {
      buyQuantity,
      showQuickShards,
      ignoreBank
    };

    localStorage.setItem('bqs-prefs', JSON.stringify(prefs));
  }

  function onToggleQuickShards () {
    showQuickShards = !showQuickShards;
    savePrefs();
    toggleShopMenu('bqs');
  }

  function onIgnoreBankChange () {
    ignoreBank = !ignoreBank;
    savePrefs();
    update();
  }

  function onCustomQuantity (e) {
    const quantity = parseInt(e.target.value);
    if (isNaN(quantity)) return;
    setBuyQuantity(quantity);
  }

  function setBuyQuantity (quantity) {
    buyQuantity = quantity;
    $buyButton.text(`Buy x${buyQuantity}`);
    savePrefs();
    update();
  }

  function buy() {
    if (buyQuantity < 1) return;
    if (!shardsToBuy.length) return;
    
    const originalBuyQty = buyQty;
    
    for (const shard of shardsToBuy) {
      if (!shard.quantity) continue;
      
      buyQty = shard.quantity;
      buyShopItem(summoningShardShopCategory, summoningShardShopIds[shard.id], true);
    }
    
    buyQty = originalBuyQty;
    
    update();
  }

  function update () {
    calculateShardsToBuy();
    updateItemContainer();
    updateTotalCostContainer();
  }

  function calculateShardsToBuy () {
    if (selectedSummon === undefined || selectedSummon === null) {
      shardsToBuy = [];
      return;
    }

    const itemId = summoningItems[selectedSummon].itemID;
    const item = items[itemId];
    const recipeId = summoningData.defaultRecipe[item.masteryID[1]];
    const recipe = item.summoningReq[recipeId];
    
    shardsToBuy = [];
    
    for (const [i, item] of recipe.entries()) {
      if (!summoningShardIds.includes(item.id)) continue;
      
      let quantityToBuy = getSummoningRecipeQty(itemId, recipeId, i) * buyQuantity;
      if (!ignoreBank) quantityToBuy = Math.max(quantityToBuy - getBankQty(item.id), 0);
      
      shardsToBuy.push({
        id: item.id,
        cost: items[item.id].buysFor,
        quantity: quantityToBuy
      });
    }
  }

  function calculateMaxCraftQuantity() {
    if (selectedSummon === undefined || selectedSummon === null) {
      return 0;
    }

    const itemId = summoningItems[selectedSummon].itemID;
    const item = items[itemId];
    const recipeId = summoningData.defaultRecipe[item.masteryID[1]];
    const recipe = item.summoningReq[recipeId];
    
    const maxCraftAmounts = [];
    
    for (const [i, item] of recipe.entries()) {
      if (summoningShardIds.includes(item.id)) continue;
      
      const quantityNeeded = getSummoningRecipeQty(itemId, recipeId, i);
      let quantityAvailable = getBankQty(item.id);
      // if (item.id === -4) quantityAvailable = gp;
      if (item.id === -5) quantityAvailable = slayerCoins;
      
      maxCraftAmounts.push(Math.floor(quantityAvailable / quantityNeeded));
    }
    
    return Math.min(...maxCraftAmounts);
  }

  function updateItemContainer () {
    if (!shardsToBuy.length) {
      $itemContainer.html('-');
      return;
    }

    $itemContainer.html('');
    for (const [i, shard] of shardsToBuy.entries()) {
      $itemContainer.append(createItemRecipeElement(shard.id, shard.quantity, 'bqs-summoning-item-buying-img-' + i));
      tooltipInstances.summoning = tooltipInstances.summoning.concat(
        tippy("#bqs-summoning-item-buying-img-" + i, {
          content: items[shard.id].name,
          placement: "top",
          interactive: false,
          animation: false,
        }));
    }
  }

  function updateTotalCostContainer () {
    if (!shardsToBuy.length) {
      $totalCostContainer
        .removeClass('text-success text-danger')
        .text('-');
      $buyButton.prop('disabled', true);
      return;
    }

    const totalCost = shardsToBuy.reduce((acc, shard) => acc + (shard.cost * shard.quantity), 0);
    const canBuy = totalCost <= gp;
    $totalCostContainer
      .toggleClass('text-success', canBuy)
      .toggleClass('text-danger', !canBuy)
      .text(formatNumber(totalCost));
    $buyButton.prop('disabled', !canBuy);
  }

  function getSummoningShardShopCategory () {
    return Object.keys(SHOP).find(cat => SHOP[cat].some(item => item.name === items[summoningShardIds[0]].name));
  }

  function getSummoningShardShopIds () {
    const shopIds = {};
    for (const shardId of summoningShardIds) {
      shopIds[shardId] = SHOP[summoningShardShopCategory].indexOf(SHOP[summoningShardShopCategory].find(shopItem => shopItem.name === items[shardId].name));
    }
    return shopIds;
  }

  function inject (block) {
    $('#summoning-creation-element')
      .find('#skill-recipe-selection-21')
      .closest('.block')
      .after(block);
  }

  function buildBlock () {
    const block = build('div', 'col-12 block block-rounded-double bg-combat-inner-dark pt-2 pb-1 text-center');
    block.append(buildHeader());
    block.append(buildBody());

    return block;
  }

  function buildHeader () {
    const header = build('div', 'block-header block-header-default pointer-enabled',
      { style: 'background: transparent!important;' })
      .on('click', onToggleQuickShards);

    const h3 = build('h3', 'block-title text-left')
      .text('Quick Buy Shards');

    const eyeCons = build('div', 'block-options')
      .append(build('i', 'far fa-eye', { id: 'shop-icon-open-bqs' }).toggleClass('d-none', !showQuickShards))
      .append(build('i', 'far fa-eye-slash', { id: 'shop-icon-closed-bqs' }).toggleClass('d-none', showQuickShards));

    header.append(h3).append(eyeCons);

    return header;
  }

  function buildBody () {
    const body = build('div', 'row no-gutters', { id: 'shop-cat-bqs' }).toggleClass('d-none', !showQuickShards);

    body
      .append(buildQuickShardItems())
      .append(build('div', 'col-12 row no-gutters justify-content-center align-items-center')
        .append(buildTotalCost())
        .append(buildBuyButtonGroup()))
      .append(build('div', 'col-12')
        .append(buildIgnoreBank()));

    return body;
  }

  function buildQuickShardItems () {
    const itemContainer = build('div', 'row justify-content-center').text('-');
    $itemContainer = itemContainer;

    return build('div', 'col-12 mb-3')
        .append(build('div', 'col-12')
          .append(itemContainer));
  }

  function buildTotalCost () {
    const totalCostHeader = build('h5', 'font-w-600 font-size-sm mb-1').text('Total Cost');
    const gpIcon = build('img', 'skill-icon-xs m-1', { src: CDNDIR + 'assets/media/main/coins.svg' });
    const totalCostContainer = build('mr-2').text('-');
    $totalCostContainer = totalCostContainer;

    return build('div', 'col-12 col-sm-auto').css('minWidth', '100px')
      .append(totalCostHeader)
      .append(build('div', 'col-12')
        .append(gpIcon)
        .append(totalCostContainer));
  }

  function buildBuyButtonGroup () {
    const buyButtonGroup = build('div', 'btn-group');
    const buyButton = build('button', 'btn btn-primary', { disabled: true }).text(`Buy x${buyQuantity}`)
      .on('click', buy);
    $buyButton = buyButton;
    const dropdownButton = build('button', 'btn btn-primary dropdown-toggle dropdown-toggle-split', null, {
      'data-toggle': 'dropdown',
      'aria-haspopup': true,
      'aria-expanded': false
    });
    const dropdownMenu = build('div', 'dropdown-menu dropdown-menu-right font-size-sm');
    for (let quantity of [1, 10, 100, 1000]) {
      dropdownMenu.append(
        build('a', 'dropdown-item pointer-enabled').text('x' + quantity)
        .on('click', () => setBuyQuantity(quantity)));
    }
    dropdownMenu.append(
      build('a', 'dropdown-item pointer-enabled').text('Max')
      .on('click', () => setBuyQuantity(calculateMaxCraftQuantity())));
    dropdownMenu.append(build('div', 'dropdown-divider', { role: 'separator' }));

    const customQuantityLabel = build('label', null, { for: 'bqs-quantity-custom-amount' }).text('Custom Amount:');
    const customQuantityInput = build('input', 'form-control', {
      name: 'bqs-quantity-custom-amount',
      placeholder: 100
    }).on('input', onCustomQuantity);
    dropdownMenu.append(
      build('div', 'p-2 form-group').append(customQuantityLabel).append(customQuantityInput));

    buyButtonGroup.append(buyButton).append(dropdownButton).append(dropdownMenu);

    return build('div', 'col-12 col-sm-auto')
      .append(buyButtonGroup);
  }

  function buildIgnoreBank () {
    const ignoreBankInput = build('input', 'custom-control-input', {
        type: 'checkbox',
        id: 'bqs-ignore-bank',
        name: 'bqs-ignore-bank'
      }).prop('checked', ignoreBank)
      .on('change', onIgnoreBankChange);
    const ignoreBankLabel = build('label', 'custom-control-label', { for: 'bqs-ignore-bank' }).text('Ignore shards in bank');

    return build('div', 'custom-control custom-checkbox custom-control-inline form-control-sm')
      .append(ignoreBankInput)
      .append(ignoreBankLabel);
  }

  function build (el, classes, props, attrs) {
    const element = $('<' + el + '>');
    if (classes) element.addClass(classes);
    if (props) element.prop(props);
    if (attrs) element.attr(attrs);

    return element;
  }

  init();
})();