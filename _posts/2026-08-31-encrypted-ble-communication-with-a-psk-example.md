---
layout: post
title: "Encrypted BLE Communication with a PSK Example"
date: 2026-08-31
description: "A practical example of application-layer AES-GCM encryption between a Python BLE Central and a Node.js BLE Peripheral."
tags: [bluetooth, ble, security, encryption, software-engineering]
---

I was invited to teach a Software Engineering class at my alma mater last fall. I decided to teach the students about Bluetooth Low Energy and cybersecurity concepts. I remember being a Computer Engineering senior struggling to find examples around BLE for my capstone project. Searching online yields either the Bluetooth docs or a bunch of dev shops selling BLE know-how, but hardly any examples unless your development kit or stack provides them. Even so, they don’t really show it in action.

Even now with easy access to LLMs, you can build and run something pretty quickly, but it gets complicated pretty fast, especially if you want to take it to production. Hence, my goal here is to show an example as opposed to teaching deep BLE and security concepts.

First, a quick overview that every other article will have: Bluetooth Low Energy allows for low-power communication between a Central, such as your desktop or smartphone, and a Peripheral, such as a heart rate sensor. Once the Central and Peripheral are connected, GATT, or Generic Attribute Profile ([Part G Generic Attribute Profile (GATT)](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/Core-54/out/en/host/generic-attribute-profile--gatt-.html)), defines how data is organized and exchanged through services and characteristics. Characteristics are essentially the pieces of data your Central can read, write, or subscribe to, such as heart rate, temperature, or other sensor data.

When securing the data exchanged between the devices, you can leverage BLE’s built-in security as well as security provided at the application layer. In this example, I’m focusing on application-layer encryption.

Quick security concepts: the readable data object is referred to as plaintext. Once encrypted, that data becomes ciphertext. The example uses Advanced Encryption Standard in Galois/Counter Mode, or AES-GCM, which converts plaintext into ciphertext using a key, a nonce, and the plaintext itself. AES-GCM also authenticates the data so that the receiver can verify that it was not modified in transit.

The nonce must be unique for a given key and can be generated using a cryptographically secure random source available on the platform. The encryption key itself depends on how your system provisions or derives keys. In a production system, for example, devices could use a key exchange such as ECDH and authenticate each other using certificates provisioned as part of a Public Key Infrastructure. See [RFC 5280](https://datatracker.ietf.org/doc/html/rfc5280) if you want to learn more about PKI and certificates.

In this example, however, we’re using a pre-shared key, or PSK, which is a symmetric key already known by both the Central and Peripheral. The convenience of symmetric encryption is that it allows for fast encryption and decryption of information by both devices without adding all of the infrastructure required for device identity and key exchange.

My example is a Python BLE Central that scans for and connects to a Node.js BLE Peripheral that sends temperature sensor data along with a timestamp. The setup includes defining the Central and Peripheral GATT profiles, scanning for the Peripheral, connecting, reading its characteristics, and exchanging both plaintext and encrypted sensor data.

It also shows how to use Apple PacketLogger to visualize the BLE traffic, which makes a world of difference when you’re working with networking traffic. Feel free to port the example to Linux or Windows and use Wireshark instead. For an embedded engineer starting out, these are incredible tools to add to your skills.

I have made many assumptions here and intentionally did not go into detail about how to build a production-ready key management system, which is beyond the goal of this example. A real production BLE application may use certificate-backed device identity, ECDH key exchange such as X25519, proper key provisioning and rotation, secure key storage, and BLE’s built-in security in addition to application-layer encryption.

The point of this example is much simpler: show what encrypted BLE communication actually looks like, get it running, and give you something concrete to build from.
