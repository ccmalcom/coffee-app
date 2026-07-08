# Tasting-Note Normalization Map (v1)

Maps free-text roaster tasting notes onto a small set of flavor-territory clusters. Seeds `coffees.tasting_notes` normalization and the taste-profile clusters built in Plan 3.

## fruit_candied
watermelon bubble gum, strawberry yogurt candy, mango creamsicle, pink lemonade, tropical candy, fruit punch, bubblegum, cotton candy, jolly rancher, skittles

## fruit_fresh
strawberry, blueberry, raspberry, cherry, red apple, green apple, pear, peach, apricot, plum, grape

## fruit_dried_wine
raisin, fig, date, dried cherry, port wine, red wine, tannic, boozy, fermented fruit

## citrus
lemon, lime, orange, grapefruit, bergamot, mandarin, tangerine

## floral
jasmine, rose, hibiscus, lavender, orange blossom, chamomile, bergamot floral

## tropical
pineapple, papaya, passionfruit, guava, lychee, mango (fresh, non-candied)

## nutty_cocoa
almond, hazelnut, walnut, peanut, cocoa, dark chocolate, milk chocolate, cocoa nib

## sweet_dessert
caramel, brown sugar, molasses, maple syrup, honey, vanilla, toffee, marshmallow

## spice
cinnamon, clove, nutmeg, black pepper, ginger, allspice

## funky_savory
funky, barnyard, umami, olive, soy, fermented, cheesy, gamey

## Normalization rule
Store `tasting_notes` as the roaster's own normalized short phrases (lowercased, trimmed — e.g. "watermelon bubble gum"), not the cluster names themselves. Cluster names are a separate lookup the taste profile (Plan 3) computes over these phrases. This file is that lookup's seed data — extend it as new phrases show up in real listings.
