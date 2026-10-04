---
# Content Studio context file.
# Everything the studio knows about your brand comes from this file. The YAML below holds
# structured fields; the Markdown body after the closing --- is free-form guidance that is
# added to every writing prompt. Only `industry` and `summary` are required.
#
# Fernhouse is a fictional brand used as an example.

# Brand name used in prompts. Defaults to SITE_NAME from .env.
name: Fernhouse
tagline: Healthy houseplants, delivered, with care help when you need it
# Used for the writing voice: "an experienced practitioner in <industry>".
industry: houseplant care
# One or two sentences: what the business is and who it's for.
summary: >-
  Fernhouse is an online houseplant shop that ships potted plants across the
  contiguous US and helps customers keep them alive with free care guides and a
  photo-based plant diagnosis service.

# Who you write for. The first entry is the main reader.
audience:
  - name: first-time plant owners
    needs: Want plants that are hard to kill and plain-English care steps.
  - name: renters in small apartments
    needs: Low light, little space, plants that fit on a shelf or windowsill.
  - name: cat and dog owners
    needs: Need to know which plants are safe to keep around pets.

product:
  # What the product actually does. The writer only describes these.
  does:
    - Ships potted houseplants in nursery pots with care cards to the contiguous US.
    - Free Plant Doctor service; customers email a photo and get care advice within two business days.
    - Free care guides for every plant sold.
  # What it doesn't do. The writer never claims these.
  doesNot:
    - Does not ship outside the contiguous US.
    - Does not give veterinary advice.
    - Does not sell outdoor plants, seeds or garden supplies.
  # Pages the "where we fit" section may link to.
  pages:
    - url: /shop
      label: the plant shop
    - url: /plant-doctor
      label: free Plant Doctor photo diagnosis
    - url: /care-guides
      label: plant care guides

facts:
  # Facts the writer may use, each with a source it must name.
  allowed:
    - fact: The NASA Clean Air Study (Wolverton and colleagues, 1989) tested plants in small sealed chambers, not in real homes.
      source: NASA Clean Air Study, 1989
    - fact: A 2019 review in the Journal of Exposure Science & Environmental Epidemiology (Cummings and Waring) found you would need roughly 10 to 1,000 potted plants per square meter to match the air cleaning that normal building ventilation already does.
      source: Cummings and Waring, 2019
    - fact: The ASPCA keeps a searchable list of plants that are toxic and non-toxic to cats, dogs and horses.
      source: ASPCA
    - fact: The ASPCA lists pothos (Epipremnum aureum) and snake plant (Dracaena trifasciata) as toxic to cats and dogs.
      source: ASPCA toxic plant list
  # Claims that must never appear.
  banned:
    - that houseplants noticeably purify the air in a home
    - that a plant is pet-safe without naming the ASPCA list as the source
    - that any plant is impossible to kill or guaranteed to thrive

# Internal links added automatically when a trigger phrase appears (max 4 per post).
links:
  - url: /blog/overwatering-signs
    anchor: signs of overwatering
    triggers: [overwatering, overwatered, root rot, soggy soil]
  - url: /blog/pet-safe-houseplants
    anchor: pet-safe houseplants
    triggers: [pet-safe, safe for cats, safe for dogs, toxic to cats]
  - url: /plant-doctor
    anchor: Plant Doctor
    triggers: [yellow leaves, brown tips, diagnose, drooping]

# Added at the end of a post when no internal link was placed.
cta: Not sure what's wrong with your plant? Send a photo to the [Plant Doctor](/plant-doctor) and we'll take a look.

# Blog categories. Keywords decide which category a post gets; defaultCategory is the fallback.
categories:
  - name: Plant Care
    keywords: [water, watering, light, soil, repot, repotting, fertilizer, humidity]
  - name: Pests & Problems
    keywords: [pest, pests, gnats, mealybugs, yellow, brown, root rot, drooping]
  - name: Pets & Safety
    keywords: [cat, cats, dog, dogs, pet, pets, toxic, poisonous]
  - name: Buying Guides
    keywords: [best, alternative, vs, buy, beginner]
defaultCategory: Plant Care

# Tags used as fallback keywords.
tags: [Houseplant Care, Low Light Plants, Pet-Safe Plants, Plant Problems]
# Words kept uppercase in tags (ai, api, faq, seo and url always are).
acronyms: [LED, UV, DIY]

# Other brands. Only used for "<competitor> alternative" topic ideas.
competitors: [Leafbox, Rootly]
# Topics the calendar never plans.
avoidTopics:
  - outdoor gardening, lawns and landscaping
  - growing plants for consumption
# Extra guidance for "Add 6 ideas".
planning:
  - Seasonal care topics (winter light, summer heat, vacation watering) a few weeks before the season.

# Optional: replace the default article structure (between the direct answer and the FAQ).
# outline:
#   - "Why this matters: what happens to the plant if you get it wrong."
#   - "Step by step: numbered, concrete steps."
#   - "Where Fernhouse fits: 2-3 sentences, mention /plant-doctor."

# Optional: appended to posts that mention a trigger word.
disclaimer:
  text: This is general plant-care information, not veterinary advice. If you think your pet has eaten a toxic plant, call your vet or the ASPCA Animal Poison Control Center right away.
  triggers: [toxic, poisonous, ingested, pet-safe]

# Optional: before/after pairs that teach the rewrite step your voice.
# Without them, neutral examples are used.
voiceExamples:
  - draft: Overwatering is one of the most common causes of houseplant decline, as saturated soil deprives roots of oxygen.
    rewrite: Here's the thing. Most plants don't die of thirst, they drown. Soil that stays soggy cuts the roots off from air, and then they rot.
  - draft: It is advisable to verify the light requirements of a plant prior to purchase.
    rewrite: Check the light first. Honestly, it's the one thing you can't fix later with a better watering schedule.

# Optional: frontmatter of saved posts. Default keys:
#   title, meta_title, description, date, updated, categories, tags, draft
# Rename a key with a string, drop it with false, and add fixed keys under `extra`.
# frontmatter:
#   fields:
#     description: summary
#     meta_title: false
#   extra:
#     layout: post
---

## Voice

Friendly and practical, like a plant-shop employee who actually keeps plants at home. Use the common name first and the botanical name in parentheses on first mention, for example "snake plant (Dracaena trifasciata)".

## Pricing

Never quote prices or discounts. Link to [/shop](/shop) instead.

## Care advice

- Give watering advice as "when the top inch of soil is dry", not as a fixed schedule.
- Say which light a plant needs in plain terms (bright indirect, medium, low) and what that looks like in a home.
